// meta-update-ad — meta-edits-suite (Sprint 2/8)
// Edita ad Meta (status, name, troca de creative).
// Diferenca pros outros: nao temos tabela 'ads' local universal — operamos via external_id.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  metaPatch,
  preflightDriftCheck,
  fireBackgroundSync,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const PayloadSchema = z.object({
  ad_id: z.string().uuid().optional(),
  ad_external_id: z.string().optional(),
  name: z.string().min(1).max(250).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  creative_id: z.string().optional(), // Meta creative external id
  force: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.ad_id || d.ad_external_id, {
  message: 'need_ad_id_or_external_id',
});

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const ctx = await resolveMetaContext(req, supabaseAdmin);
  if (!ctx.ok) return ctx.response;
  const { companyId, userId, metaToken } = ctx.value;

  let payload: z.infer<typeof PayloadSchema>;
  try {
    payload = PayloadSchema.parse(await req.json());
  } catch (e: any) {
    return jsonResponse({ error: 'invalid_payload', detail: e?.errors ?? e?.message }, 400, cors);
  }

  // Ads no nivel granular NAO tem tabela local dedicada (so adsets/campaigns sao sincronizados).
  // Se o user passar ad_id como UUID, interpretamos como campaign_publications.id e resolvemos meta_ad_id.
  // Caso contrario, exigimos ad_external_id direto da Meta.
  let publicationRow: { id: string; meta_ad_id: string | null } | null = null;
  let localAd: any = null;
  let externalId = payload.ad_external_id ?? null;
  if (payload.ad_id && !externalId) {
    const { data } = await supabaseAdmin
      .from('campaign_publications')
      .select('id, meta_ad_id, company_id')
      .eq('id', payload.ad_id)
      .maybeSingle();
    if (data && data.company_id === companyId && data.meta_ad_id) {
      publicationRow = { id: data.id, meta_ad_id: data.meta_ad_id };
      externalId = data.meta_ad_id;
    } else {
      return jsonResponse({
        error: 'ad_not_found',
        hint: 'ad_id deve ser um UUID de campaign_publications. Alternativamente, passe ad_external_id direto.',
      }, 404, cors);
    }
  }

  if (!externalId) return jsonResponse({ error: 'no_external_id' }, 400, cors);

  const actionKind = payload.creative_id
    ? 'update_ad_creative'
    : payload.status
      ? `update_ad_status_${payload.status.toLowerCase()}`
      : 'update_ad';

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-update-ad',
        actionKind,
        costBrlEstimate: 0, // ad-level edits nao alteram budget
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'ad',
        targetExternalId: externalId,
      },
      async () => {
        if (!payload.force && localAd) {
          const { drift, divergedFields } = await preflightDriftCheck(
            externalId!,
            ['status'],
            { status: localAd.status },
            metaToken,
          );
          if (drift) throw new Error(`drift_detected: ${divergedFields.join(',')}`);
        }

        const metaFields: Record<string, any> = {};
        if (payload.name !== undefined) metaFields.name = payload.name;
        if (payload.status !== undefined) metaFields.status = payload.status;
        if (payload.creative_id !== undefined) metaFields.creative = { creative_id: payload.creative_id };

        if (Object.keys(metaFields).length === 0) {
          return { ok: true, external_id: externalId, fields_updated: [], no_op: true };
        }

        const metaResp = await metaPatch(externalId!, metaFields, metaToken);

        // Sem tabela local de ads — atualizamos campaign_publications se conhecida.
        if (publicationRow) {
          const localPatch: Record<string, any> = {};
          if (payload.creative_id !== undefined) localPatch.meta_creative_id = payload.creative_id;
          if (Object.keys(localPatch).length > 0) {
            await supabaseAdmin
              .from('campaign_publications')
              .update(localPatch)
              .eq('id', publicationRow.id);
          }
        }

        fireBackgroundSync(supabaseAdmin, companyId, 'ad', externalId!);

        return {
          ok: true,
          external_id: externalId,
          fields_updated: Object.keys(metaFields),
          meta_response: metaResp,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({ ok: true, sandbox: true, simulated: true, would_update: payload, ledger_id: ledgerId }, 200, cors);
      }
      return jsonResponse({ ok: false, blocked: true, reason: gate.block_reason, gate, ledger_id: ledgerId }, 429, cors);
    }

    return jsonResponse({ ok: true, ...(result ?? {}), ledger_id: ledgerId, sandbox: gate.sandbox ?? false }, 200, cors);
  } catch (err: any) {
    const isMeta = err instanceof MetaApiError;
    return jsonResponse({
      ok: false,
      error: err?.message ?? 'unknown_error',
      meta_error: isMeta ? { code: err.code, graph: err.graphError } : undefined,
      ledger_id: err?.ledgerId,
    }, isMeta ? 502 : 500, cors);
  }
});
