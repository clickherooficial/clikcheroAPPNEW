// meta-audience-update — audience-management (Sprint 3/8)
// Edita name/description/retention_days de uma audiencia.
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
import { resolveAudienceExternal } from '../_shared/audience-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const PayloadSchema = z.object({
  audience_id: z.string().uuid().optional(),
  audience_external_id: z.string().optional(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(255).optional(),
  retention_days: z.number().int().min(1).max(540).optional(),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
}).refine((d) => d.audience_id || d.audience_external_id, {
  message: 'need_audience_id_or_external_id',
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

  let resolved: { external_id: string; local_id: string | null };
  try {
    resolved = await resolveAudienceExternal(
      supabaseAdmin,
      companyId,
      payload.audience_id,
      payload.audience_external_id,
    );
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? 'resolve_failed' }, 404, cors);
  }

  const fields: Record<string, any> = {};
  if (payload.name !== undefined) fields.name = payload.name;
  if (payload.description !== undefined) fields.description = payload.description;
  if (payload.retention_days !== undefined) fields.retention_days = payload.retention_days;

  if (Object.keys(fields).length === 0) {
    return jsonResponse({ ok: true, no_op: true }, 200, cors);
  }

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-audience-update',
        actionKind: 'update_audience',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'audience',
        targetExternalId: resolved.external_id,
      },
      async () => {
        await metaPatch(resolved.external_id, fields, metaToken);

        if (resolved.local_id) {
          await supabaseAdmin
            .from('meta_audiences')
            .update({ ...fields, local_updated_at: new Date().toISOString() })
            .eq('id', resolved.local_id);
        }

        return {
          ok: true,
          audience_id: resolved.local_id,
          external_id: resolved.external_id,
          fields_updated: Object.keys(fields),
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_update: fields,
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
