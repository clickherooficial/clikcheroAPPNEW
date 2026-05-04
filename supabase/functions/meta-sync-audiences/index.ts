// meta-sync-audiences — audience-management (Sprint 3/8)
// Pagina /act_{id}/customaudiences e upserta em meta_audiences.
// Idempotente — re-rodar nao duplica.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  resolveMetaContextByCompanyId,
  isAdminInvoke,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { fetchAudiencePages } from '../_shared/audience-helpers.ts';

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let companyId: string;
  let adAccountId: string;
  let metaToken: string;

  if (isAdminInvoke(req)) {
    const body = await req.json().catch(() => ({}));
    if (!body?.company_id) return jsonResponse({ error: 'company_id_required' }, 400, cors);
    const r = await resolveMetaContextByCompanyId(supabaseAdmin, body.company_id);
    if (!r.ok) return jsonResponse({ error: r.error }, 422, cors);
    ({ companyId, adAccountId, metaToken } = r.value);
  } else {
    const ctx = await resolveMetaContext(req, supabaseAdmin);
    if (!ctx.ok) return ctx.response;
    ({ companyId, adAccountId, metaToken } = ctx.value);
  }

  try {
    const remote = await fetchAudiencePages(adAccountId, metaToken);
    let upserted = 0;
    let errors = 0;

    // Meta retorna time_created/time_updated como Unix int OU string ISO; timestamptz so aceita ISO/Date.
    const toIso = (v: any): string | null => {
      if (v == null) return null;
      const n = typeof v === 'string' ? Number(v) : v;
      if (typeof n === 'number' && Number.isFinite(n)) {
        // Heuristica: <1e12 = segundos; >=1e12 = ms
        const ms = n < 1e12 ? n * 1000 : n;
        return new Date(ms).toISOString();
      }
      return typeof v === 'string' ? v : null;
    };

    for (const a of remote) {
      const subtype = (a.subtype ?? 'CUSTOM').toUpperCase();
      const validSubtype = ['CUSTOM', 'LOOKALIKE', 'WEBSITE', 'APP', 'ENGAGEMENT'].includes(subtype)
        ? subtype
        : 'CUSTOM';

      const { error } = await supabaseAdmin
        .from('meta_audiences')
        .upsert(
          {
            company_id: companyId,
            external_id: String(a.id),
            name: a.name ?? '(unnamed)',
            description: a.description ?? null,
            subtype: validSubtype,
            approximate_count_lower_bound: a.approximate_count_lower_bound ?? null,
            approximate_count_upper_bound: a.approximate_count_upper_bound ?? null,
            delivery_status: a.delivery_status ?? null,
            operation_status: a.operation_status ?? null,
            retention_days: a.retention_days ?? null,
            lookalike_spec: a.lookalike_spec ?? null,
            rule: a.rule ?? null,
            time_created: toIso(a.time_created),
            time_updated: toIso(a.time_updated),
            local_updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,external_id' },
        );

      if (error) {
        errors += 1;
        console.error('[meta-sync-audiences] upsert failed', a.id, error.message);
      } else {
        upserted += 1;
      }
    }

    return jsonResponse({
      ok: true,
      synced: upserted,
      errors,
      remote_count: remote.length,
    }, 200, cors);
  } catch (err: any) {
    const isMeta = err instanceof MetaApiError;
    return jsonResponse({
      ok: false,
      error: err?.message ?? 'unknown_error',
      meta_error: isMeta ? { code: err.code, graph: err.graphError } : undefined,
    }, isMeta ? 502 : 500, cors);
  }
});
