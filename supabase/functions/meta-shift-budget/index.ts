// meta-shift-budget — meta-edits-suite (Sprint 2/8)
// Move budget entre 2 entidades (campaign->campaign, adset->adset, etc) com rollback.
// Sequencia: 1) decrementa origem, 2) incrementa destino. Se 2) falhar, rollback do 1).
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  metaPatch,
  fireBackgroundSync,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { withSafetyRails, logAgentAction } from '../_shared/safety-rails.ts';

const PayloadSchema = z.object({
  from_entity_kind: z.enum(['campaign', 'adset']),
  from_entity_id: z.string().uuid().optional(),
  from_external_id: z.string().optional(),
  to_entity_kind: z.enum(['campaign', 'adset']),
  to_entity_id: z.string().uuid().optional(),
  to_external_id: z.string().optional(),
  amount_brl: z.number().positive(),
  force: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => (d.from_entity_id || d.from_external_id) && (d.to_entity_id || d.to_external_id), {
  message: 'need_both_endpoints',
});

interface Endpoint { external_id: string; daily_budget: number; table: string; }

async function loadEndpoint(
  supabaseAdmin: any,
  companyId: string,
  kind: 'campaign' | 'adset',
  id?: string,
  externalId?: string,
): Promise<Endpoint | null> {
  const table = kind === 'campaign' ? 'campaigns' : 'adsets';
  let q = supabaseAdmin.from(table).select('external_id, daily_budget, company_id');
  if (id) q = q.eq('id', id);
  else if (externalId) q = q.eq('external_id', externalId);
  else return null;
  const { data } = await q.maybeSingle();
  if (!data || data.company_id !== companyId) return null;
  return { external_id: data.external_id, daily_budget: Number(data.daily_budget ?? 0), table };
}

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

  const fromEp = await loadEndpoint(supabaseAdmin, companyId, payload.from_entity_kind, payload.from_entity_id, payload.from_external_id);
  const toEp = await loadEndpoint(supabaseAdmin, companyId, payload.to_entity_kind, payload.to_entity_id, payload.to_external_id);
  if (!fromEp || !toEp) return jsonResponse({ error: 'endpoint_not_found' }, 404, cors);

  if (fromEp.daily_budget < payload.amount_brl) {
    return jsonResponse({
      error: 'insufficient_source_budget',
      from_daily: fromEp.daily_budget,
      requested: payload.amount_brl,
    }, 422, cors);
  }

  const newFrom = fromEp.daily_budget - payload.amount_brl;
  const newTo = toEp.daily_budget + payload.amount_brl;

  // shift nao adiciona spend total (apenas redistribui), entao costBrl = 0
  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-shift-budget',
        actionKind: 'shift_budget',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'budget_shift',
        targetExternalId: `${fromEp.external_id}->${toEp.external_id}`,
      },
      async () => {
        // step 1: decrementa origem
        await metaPatch(fromEp.external_id, { daily_budget: Math.round(newFrom * 100) }, metaToken);

        // step 2: incrementa destino — se falhar, rollback step 1
        try {
          await metaPatch(toEp.external_id, { daily_budget: Math.round(newTo * 100) }, metaToken);
        } catch (e: any) {
          try {
            await metaPatch(fromEp.external_id, { daily_budget: Math.round(fromEp.daily_budget * 100) }, metaToken);
            await logAgentAction(supabaseAdmin, {
              companyId,
              agentName: 'meta-shift-budget',
              actionKind: 'shift_budget_rollback',
              status: 'rolled_back',
              payload: { reason: e?.message },
              targetKind: 'budget_shift',
              targetExternalId: fromEp.external_id,
              triggeredBy: payload.triggered_by,
              triggeredById: userId,
            });
          } catch (rollbackErr) {
            console.error('[meta-shift-budget] ROLLBACK FAILED', rollbackErr);
          }
          throw e;
        }

        // local update — atomico best-effort
        await supabaseAdmin.from(fromEp.table).update({ daily_budget: newFrom, local_updated_at: new Date().toISOString() }).eq('external_id', fromEp.external_id);
        await supabaseAdmin.from(toEp.table).update({ daily_budget: newTo, local_updated_at: new Date().toISOString() }).eq('external_id', toEp.external_id);

        fireBackgroundSync(supabaseAdmin, companyId, payload.from_entity_kind, fromEp.external_id);
        fireBackgroundSync(supabaseAdmin, companyId, payload.to_entity_kind, toEp.external_id);

        return {
          ok: true,
          from: { external_id: fromEp.external_id, daily_budget: newFrom },
          to: { external_id: toEp.external_id, daily_budget: newTo },
          amount_brl: payload.amount_brl,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({ ok: true, sandbox: true, simulated: true, would_shift: payload, ledger_id: ledgerId }, 200, cors);
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
