// meta-update-adset — meta-edits-suite (Sprint 2/8)
// Edita adset Meta (budget, status, optimization_goal, bid, targeting merge, schedule).
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  metaPatch,
  metaGet,
  preflightDriftCheck,
  fireBackgroundSync,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const PayloadSchema = z.object({
  adset_id: z.string().uuid().optional(),
  adset_external_id: z.string().optional(),
  name: z.string().min(1).max(250).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  daily_budget: z.number().min(5).optional(),
  lifetime_budget: z.number().min(50).optional(),
  optimization_goal: z.enum([
    'LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'LANDING_PAGE_VIEWS',
    'POST_ENGAGEMENT', 'REACH', 'IMPRESSIONS',
  ]).optional(),
  bid_amount: z.number().positive().optional(),
  targeting_patch: z.record(z.unknown()).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  force: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.adset_id || d.adset_external_id, {
  message: 'need_adset_id_or_external_id',
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

  let localAdset: any = null;
  let externalId = payload.adset_external_id;
  if (payload.adset_id) {
    const { data, error } = await supabaseAdmin
      .from('adsets')
      .select('*')
      .eq('id', payload.adset_id)
      .single();
    if (error || !data) return jsonResponse({ error: 'adset_not_found' }, 404, cors);
    if (data.company_id !== companyId) return jsonResponse({ error: 'forbidden' }, 403, cors);
    localAdset = data;
    externalId = data.external_id;
  } else if (externalId) {
    const { data } = await supabaseAdmin
      .from('adsets')
      .select('*')
      .eq('external_id', externalId)
      .eq('company_id', companyId)
      .maybeSingle();
    localAdset = data;
  }

  if (!externalId) return jsonResponse({ error: 'no_external_id' }, 400, cors);

  const oldDaily = Number(localAdset?.daily_budget ?? 0);
  const newDaily = payload.daily_budget ?? oldDaily;
  const delta = newDaily - oldDaily;
  const costBrlEstimate = delta > 0 ? delta * 30 : 0;
  const actionKind = delta > 0
    ? 'update_budget_up'
    : delta < 0
      ? 'update_budget_down'
      : 'update_adset';

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-update-adset',
        actionKind,
        costBrlEstimate,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'adset',
        targetExternalId: externalId,
      },
      async () => {
        // drift check em status/budget
        if (!payload.force && localAdset) {
          const { drift, divergedFields, remote } = await preflightDriftCheck(
            externalId!,
            ['status', 'daily_budget', 'lifetime_budget'],
            {
              status: localAdset.status,
              daily_budget: Math.round(Number(localAdset.daily_budget ?? 0) * 100),
              lifetime_budget: Math.round(Number(localAdset.lifetime_budget ?? 0) * 100),
            },
            metaToken,
          );
          if (drift) {
            await supabaseAdmin
              .from('adsets')
              .update({
                status: remote.status,
                daily_budget: remote.daily_budget ? Number(remote.daily_budget) / 100 : null,
                lifetime_budget: remote.lifetime_budget ? Number(remote.lifetime_budget) / 100 : null,
                local_updated_at: new Date().toISOString(),
              })
              .eq('external_id', externalId);
            throw new Error(`drift_detected: ${divergedFields.join(',')}`);
          }
        }

        // targeting merge: lemos atual, fazemos shallow merge
        let mergedTargeting: any = undefined;
        if (payload.targeting_patch) {
          // resolver custom_audiences/excluded_custom_audiences:
          // se item tem 'id' que parece uuid local (formato 8-4-4-4-12), trocar pelo external_id real
          // (anti cross-tenant: validamos company_id matching)
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const resolveAudList = async (raw: any): Promise<any> => {
            if (!Array.isArray(raw)) return raw;
            const out: any[] = [];
            for (const item of raw) {
              const id = String(item?.id ?? '');
              if (UUID_RE.test(id)) {
                const { data: aud } = await supabaseAdmin
                  .from('meta_audiences')
                  .select('external_id, company_id')
                  .eq('id', id)
                  .maybeSingle();
                if (!aud || aud.company_id !== companyId) {
                  throw new Error(`audience_not_found_or_cross_tenant: ${id}`);
                }
                out.push({ id: aud.external_id });
              } else {
                out.push({ id });
              }
            }
            return out;
          };
          const patchCopy: any = { ...payload.targeting_patch };
          if (patchCopy.custom_audiences) {
            patchCopy.custom_audiences = await resolveAudList(patchCopy.custom_audiences);
          }
          if (patchCopy.excluded_custom_audiences) {
            patchCopy.excluded_custom_audiences = await resolveAudList(patchCopy.excluded_custom_audiences);
          }
          const remote = await metaGet(externalId!, ['targeting'], metaToken);
          mergedTargeting = { ...(remote.targeting ?? {}), ...patchCopy };
        }

        const metaFields: Record<string, any> = {};
        if (payload.name !== undefined) metaFields.name = payload.name;
        if (payload.status !== undefined) metaFields.status = payload.status;
        if (payload.daily_budget !== undefined) metaFields.daily_budget = Math.round(payload.daily_budget * 100);
        if (payload.lifetime_budget !== undefined) metaFields.lifetime_budget = Math.round(payload.lifetime_budget * 100);
        if (payload.optimization_goal !== undefined) metaFields.optimization_goal = payload.optimization_goal;
        if (payload.bid_amount !== undefined) metaFields.bid_amount = Math.round(payload.bid_amount * 100);
        if (mergedTargeting) metaFields.targeting = mergedTargeting;
        if (payload.start_time !== undefined) metaFields.start_time = payload.start_time;
        if (payload.end_time !== undefined) metaFields.end_time = payload.end_time;

        if (Object.keys(metaFields).length === 0) {
          return { ok: true, external_id: externalId, fields_updated: [], no_op: true };
        }

        const metaResp = await metaPatch(externalId!, metaFields, metaToken);

        const localPatch: Record<string, any> = { local_updated_at: new Date().toISOString() };
        if (payload.name !== undefined) localPatch.name = payload.name;
        if (payload.status !== undefined) localPatch.status = payload.status;
        if (payload.daily_budget !== undefined) localPatch.daily_budget = payload.daily_budget;
        if (payload.lifetime_budget !== undefined) localPatch.lifetime_budget = payload.lifetime_budget;
        if (payload.optimization_goal !== undefined) localPatch.optimization_goal = payload.optimization_goal;
        if (mergedTargeting) localPatch.targeting = mergedTargeting;
        if (payload.start_time !== undefined) localPatch.start_time = payload.start_time;
        if (payload.end_time !== undefined) localPatch.end_time = payload.end_time;

        await supabaseAdmin.from('adsets').update(localPatch).eq('external_id', externalId);
        fireBackgroundSync(supabaseAdmin, companyId, 'adset', externalId!);

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
