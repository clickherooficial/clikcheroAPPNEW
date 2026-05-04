// meta-change-schedule — meta-edits-suite (Sprint 2/8)
// Edita janela de execucao (start/stop) e ad scheduling (dayparting) em campaign ou adset.
// dayparting Meta: array de objetos {start_minute, end_minute, days[]} por timezone do account.
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
import { withSafetyRails } from '../_shared/safety-rails.ts';

const ScheduleEntry = z.object({
  start_minute: z.number().int().min(0).max(1440),
  end_minute: z.number().int().min(0).max(1440),
  days: z.array(z.number().int().min(0).max(6)).min(1),
}).refine((s) => s.end_minute > s.start_minute, {
  message: 'end_minute_must_be_after_start',
});

const PayloadSchema = z.object({
  entity_kind: z.enum(['campaign', 'adset']),
  entity_id: z.string().uuid().optional(),
  external_id: z.string().optional(),
  start_time: z.string().datetime().optional(),
  stop_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  schedule: z.array(ScheduleEntry).optional(),
  force: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.entity_id || d.external_id, { message: 'need_entity_id_or_external_id' });

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

  const table = payload.entity_kind === 'campaign' ? 'campaigns' : 'adsets';
  let externalId = payload.external_id;
  let local: any = null;
  if (payload.entity_id) {
    const { data } = await supabaseAdmin.from(table).select('*').eq('id', payload.entity_id).maybeSingle();
    if (!data || data.company_id !== companyId) return jsonResponse({ error: 'not_found' }, 404, cors);
    local = data;
    externalId = data.external_id;
  }
  if (!externalId) return jsonResponse({ error: 'no_external_id' }, 400, cors);

  // schedule so e valido em adsets com lifetime_budget
  if (payload.schedule && payload.entity_kind === 'campaign') {
    return jsonResponse({ error: 'dayparting_only_on_adsets' }, 422, cors);
  }
  if (payload.schedule && local && !local.lifetime_budget) {
    return jsonResponse({ error: 'dayparting_requires_lifetime_budget' }, 422, cors);
  }

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-change-schedule',
        actionKind: 'change_schedule',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: payload.entity_kind,
        targetExternalId: externalId,
      },
      async () => {
        const metaFields: Record<string, any> = {};
        if (payload.start_time !== undefined) metaFields.start_time = payload.start_time;
        if (payload.stop_time !== undefined) metaFields.stop_time = payload.stop_time;
        if (payload.end_time !== undefined) metaFields.end_time = payload.end_time;
        if (payload.schedule !== undefined) {
          metaFields.adset_schedule = payload.schedule.map((s) => ({
            start_minute: s.start_minute,
            end_minute: s.end_minute,
            days: s.days,
          }));
        }

        if (Object.keys(metaFields).length === 0) {
          return { ok: true, external_id: externalId, fields_updated: [], no_op: true };
        }

        const metaResp = await metaPatch(externalId!, metaFields, metaToken);

        const localPatch: Record<string, any> = { local_updated_at: new Date().toISOString() };
        if (payload.start_time !== undefined) localPatch.start_time = payload.start_time;
        if (payload.stop_time !== undefined) localPatch.stop_time = payload.stop_time;
        if (payload.end_time !== undefined) localPatch.end_time = payload.end_time;
        await supabaseAdmin.from(table).update(localPatch).eq('external_id', externalId);

        fireBackgroundSync(supabaseAdmin, companyId, payload.entity_kind, externalId!);

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
        return jsonResponse({ ok: true, sandbox: true, simulated: true, would_change: payload, ledger_id: ledgerId }, 200, cors);
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
