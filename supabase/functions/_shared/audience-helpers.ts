// audience-management (Sprint 3/8)
// Helpers compartilhados pelas 5 Edge Functions de audiencias.
// deno-lint-ignore-file no-explicit-any

import { MetaApiError, metaPatch } from './meta-edits-helpers.ts';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

export interface AudienceUploadPayload {
  schema: string[];
  data: string[][]; // ja SHA256 hex (validado pelos Zod schemas das Edge Fns)
}

/**
 * Upload de usuarios em batches de 10000 (limite Meta).
 * Retorna { batches, total_rows }. 200ms entre batches pra rate limit.
 */
export async function uploadUsersInBatches(
  audienceExternalId: string,
  payload: AudienceUploadPayload,
  token: string,
): Promise<{ batches: number; total_rows: number }> {
  const BATCH = 10000;
  let batches = 0;
  for (let i = 0; i < payload.data.length; i += BATCH) {
    const batchData = payload.data.slice(i, i + BATCH);
    await metaPatch(
      `${audienceExternalId}/users`,
      { payload: { schema: payload.schema, data: batchData } },
      token,
    );
    batches += 1;
    if (i + BATCH < payload.data.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return { batches, total_rows: payload.data.length };
}

/**
 * Pagina /act_{id}/customaudiences ate fim. 200ms entre paginas.
 */
export async function fetchAudiencePages(
  adAccountId: string,
  token: string,
): Promise<any[]> {
  const all: any[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${adAccountId}/customaudiences` +
    `?fields=id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,` +
    `delivery_status,operation_status,time_created,time_updated,description,rule,retention_days,lookalike_spec` +
    `&limit=100&access_token=${encodeURIComponent(token)}`;

  while (url) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new MetaApiError(
        j?.error?.message ?? `list_failed_${r.status}`,
        j?.error?.code ?? r.status,
        j?.error,
      );
    }
    if (Array.isArray(j.data)) all.push(...j.data);
    url = j?.paging?.next ?? null;
    if (url) await new Promise((res) => setTimeout(res, 200));
  }
  return all;
}

/**
 * Resolve audience_external_id a partir de uuid local OU passa direto se ja tiver external.
 * Lanca se nao encontrar OU se nao for da mesma company.
 */
export async function resolveAudienceExternal(
  supabaseAdmin: any,
  companyId: string,
  audienceId?: string,
  externalId?: string,
): Promise<{ external_id: string; local_id: string | null; row: any | null }> {
  if (audienceId) {
    const { data } = await supabaseAdmin
      .from('meta_audiences')
      .select('id, external_id, company_id, approximate_count_lower_bound, name, subtype')
      .eq('id', audienceId)
      .maybeSingle();
    if (!data) throw new Error('audience_not_found');
    if (data.company_id !== companyId) throw new Error('forbidden');
    return { external_id: data.external_id, local_id: data.id, row: data };
  }
  if (externalId) {
    const { data } = await supabaseAdmin
      .from('meta_audiences')
      .select('id, external_id, company_id, approximate_count_lower_bound, name, subtype')
      .eq('company_id', companyId)
      .eq('external_id', externalId)
      .maybeSingle();
    return { external_id: externalId, local_id: data?.id ?? null, row: data };
  }
  throw new Error('need_audience_id_or_external_id');
}

/**
 * Garante audiencia origem de LAL tem >=100 pessoas (limite Meta).
 * Aceita underflow no lower_bound — usa media (lower+upper)/2 quando lower=0.
 */
export function validateLookalikeOrigin(originRow: any): void {
  if (!originRow) throw new Error('origin_audience_not_synced — sync_audiences first');
  const lower = Number(originRow.approximate_count_lower_bound ?? 0);
  const upper = Number(originRow.approximate_count_upper_bound ?? 0);
  const estimate = lower > 0 ? lower : Math.floor((lower + upper) / 2);
  if (estimate < 100) {
    throw new Error(`origin_too_small: needs >=100 people, has ~${estimate}`);
  }
}
