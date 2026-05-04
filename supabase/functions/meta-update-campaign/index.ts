// meta-update-campaign — meta-edits-suite (Sprint 2/8)
// Edita uma campanha Meta existente (budget, status, name, bid strategy, schedule).
// Wrapped em withSafetyRails — sandbox e auto-blocked params do safety config.
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
  campaign_id: z.string().uuid().optional(),
  campaign_external_id: z.string().optional(),
  name: z.string().min(1).max(250).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  daily_budget: z.number().min(5).optional(),
  lifetime_budget: z.number().min(50).optional(),
  bid_strategy: z.enum(['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP']).optional(),
  bid_amount: z.number().positive().optional(),
  start_time: z.string().datetime().optional(),
  stop_time: z.string().datetime().optional(),
  force: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.campaign_id || d.campaign_external_id, {
  message: 'need_campaign_id_or_external_id',
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

  // resolve external_id e snapshot local
  let localCampaign: any = null;
  let externalId = payload.campaign_external_id;
  if (payload.campaign_id) {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', payload.campaign_id)
      .single();
    if (error || !data) return jsonResponse({ error: 'campaign_not_found' }, 404, cors);
    if (data.company_id !== companyId) return jsonResponse({ error: 'forbidden' }, 403, cors);
    localCampaign = data;
    externalId = data.external_id;
  } else if (externalId) {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('external_id', externalId)
      .eq('company_id', companyId)
      .maybeSingle();
    localCampaign = data;
  }

  if (!externalId) return jsonResponse({ error: 'no_external_id' }, 400, cors);

  // estimar custo (so contabiliza aumento de budget como gasto adicional)
  const oldDaily = Number(localCampaign?.daily_budget ?? 0);
  const newDaily = payload.daily_budget ?? oldDaily;
  const delta = newDaily - oldDaily;
  const costBrlEstimate = delta > 0 ? delta * 30 : 0;
  const actionKind = delta > 0
    ? 'update_budget_up'
    : delta < 0
      ? 'update_budget_down'
      : 'update_campaign';

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-update-campaign',
        actionKind,
        costBrlEstimate,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'campaign',
        targetExternalId: externalId,
      },
      async () => {
        // pre-flight drift
        let driftDetected = false;
        if (!payload.force && localCampaign) {
          const { drift, divergedFields, remote } = await preflightDriftCheck(
            externalId!,
            ['status', 'daily_budget', 'lifetime_budget'],
            {
              status: localCampaign.status,
              daily_budget: Math.round(Number(localCampaign.daily_budget ?? 0) * 100),
              lifetime_budget: Math.round(Number(localCampaign.lifetime_budget ?? 0) * 100),
            },
            metaToken,
          );
          if (drift) {
            // sync local com remote pra proximo retry
            await supabaseAdmin
              .from('campaigns')
              .update({
                status: remote.status,
                daily_budget: remote.daily_budget ? Number(remote.daily_budget) / 100 : null,
                lifetime_budget: remote.lifetime_budget ? Number(remote.lifetime_budget) / 100 : null,
                local_updated_at: new Date().toISOString(),
              })
              .eq('external_id', externalId);
            throw new Error(`drift_detected: ${divergedFields.join(',')}`);
          }
          driftDetected = false;
        }

        // monta fields Meta-side (centavos)
        const metaFields: Record<string, any> = {};
        if (payload.name !== undefined) metaFields.name = payload.name;
        if (payload.status !== undefined) metaFields.status = payload.status;
        if (payload.daily_budget !== undefined) metaFields.daily_budget = Math.round(payload.daily_budget * 100);
        if (payload.lifetime_budget !== undefined) metaFields.lifetime_budget = Math.round(payload.lifetime_budget * 100);
        if (payload.bid_strategy !== undefined) metaFields.bid_strategy = payload.bid_strategy;
        if (payload.bid_amount !== undefined) metaFields.bid_amount = Math.round(payload.bid_amount * 100);
        if (payload.start_time !== undefined) metaFields.start_time = payload.start_time;
        if (payload.stop_time !== undefined) metaFields.stop_time = payload.stop_time;

        if (Object.keys(metaFields).length === 0) {
          return { ok: true, external_id: externalId, fields_updated: [], drift_detected: driftDetected, no_op: true };
        }

        const metaResp = await metaPatch(externalId!, metaFields, metaToken);

        // local update — inverte centavos pra BRL nos campos numericos
        const localPatch: Record<string, any> = { local_updated_at: new Date().toISOString() };
        if (payload.name !== undefined) localPatch.name = payload.name;
        if (payload.status !== undefined) localPatch.status = payload.status;
        if (payload.daily_budget !== undefined) localPatch.daily_budget = payload.daily_budget;
        if (payload.lifetime_budget !== undefined) localPatch.lifetime_budget = payload.lifetime_budget;
        if (payload.bid_strategy !== undefined) localPatch.bid_strategy = payload.bid_strategy;
        if (payload.start_time !== undefined) localPatch.start_time = payload.start_time;
        if (payload.stop_time !== undefined) localPatch.stop_time = payload.stop_time;

        await supabaseAdmin.from('campaigns').update(localPatch).eq('external_id', externalId);
        fireBackgroundSync(supabaseAdmin, companyId, 'campaign', externalId!);

        return {
          ok: true,
          external_id: externalId,
          fields_updated: Object.keys(metaFields),
          drift_detected: driftDetected,
          meta_response: metaResp,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_update: payload,
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
