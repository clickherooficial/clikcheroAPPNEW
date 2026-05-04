// meta-audience-lookalike — audience-management (Sprint 3/8)
// Cria Lookalike Audience a partir de origem existente.
// Valida count >=100 antes; armazena parent_audience_id (lineage).
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  metaPatch,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { resolveAudienceExternal, validateLookalikeOrigin } from '../_shared/audience-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const PayloadSchema = z.object({
  name: z.string().min(1).max(80),
  origin_audience_id: z.string().uuid().optional(),
  origin_audience_external_id: z.string().optional(),
  lookalike_spec: z.object({
    country: z.string().length(2),
    ratio: z.number().refine(
      (r) => [0.01, 0.02, 0.05, 0.10].includes(r),
      'must_be_1_2_5_or_10_pct',
    ),
    type: z.enum(['similarity', 'reach', 'reach_and_similarity']).default('similarity'),
  }),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.origin_audience_id || d.origin_audience_external_id, {
  message: 'need_origin_audience_id_or_external_id',
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
  const { companyId, userId, adAccountId, metaToken } = ctx.value;

  let payload: z.infer<typeof PayloadSchema>;
  try {
    payload = PayloadSchema.parse(await req.json());
  } catch (e: any) {
    return jsonResponse({ error: 'invalid_payload', detail: e?.errors ?? e?.message }, 400, cors);
  }

  let origin: { external_id: string; local_id: string | null; row: any | null };
  try {
    origin = await resolveAudienceExternal(
      supabaseAdmin,
      companyId,
      payload.origin_audience_id,
      payload.origin_audience_external_id,
    );
    validateLookalikeOrigin(origin.row);
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? 'origin_invalid' }, 422, cors);
  }

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-audience-lookalike',
        actionKind: 'create_lookalike',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'audience',
        targetExternalId: origin.external_id,
      },
      async () => {
        const created = await metaPatch(`${adAccountId}/customaudiences`, {
          name: payload.name,
          subtype: 'LOOKALIKE',
          origin_audience_id: origin.external_id,
          lookalike_spec: payload.lookalike_spec,
        }, metaToken);

        if (!created.id) throw new Error('lookalike_create_no_id');

        const { data: localRow, error: insErr } = await supabaseAdmin
          .from('meta_audiences')
          .insert({
            company_id: companyId,
            external_id: String(created.id),
            name: payload.name,
            subtype: 'LOOKALIKE',
            parent_audience_id: origin.local_id,
            lookalike_spec: payload.lookalike_spec,
            local_updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insErr) {
          console.error('[meta-audience-lookalike] local insert failed', insErr);
        }

        return {
          ok: true,
          audience_id: localRow?.id ?? null,
          external_id: String(created.id),
          parent_audience_id: origin.local_id,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_create_lookalike: payload,
          ledger_id: ledgerId,
        }, 200, cors);
      }
      return jsonResponse({
        ok: false,
        blocked: true,
        reason: gate.block_reason,
        gate,
        ledger_id: ledgerId,
      }, 429, cors);
    }

    return jsonResponse({
      ok: true,
      ...(result ?? {}),
      ledger_id: ledgerId,
      sandbox: gate.sandbox ?? false,
    }, 200, cors);
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
