// meta-audience-delete — audience-management (Sprint 3/8)
// Deleta audiencia. Bloqueia se em uso ATIVO ou sem confirm=true.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

const PayloadSchema = z.object({
  audience_id: z.string().uuid(),
  confirm: z.boolean().default(false),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
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

  if (!payload.confirm) {
    return jsonResponse({
      ok: false,
      requires_confirmation: true,
      error: 'pass confirm=true to delete',
    }, 422, cors);
  }

  // tenant guard + load
  const { data: row, error: loadErr } = await supabaseAdmin
    .from('meta_audiences')
    .select('id, external_id, company_id, name, subtype')
    .eq('id', payload.audience_id)
    .maybeSingle();

  if (loadErr || !row) return jsonResponse({ error: 'audience_not_found' }, 404, cors);
  if (row.company_id !== companyId) return jsonResponse({ error: 'forbidden' }, 403, cors);

  // checa uso ativo
  const { data: inUse } = await supabaseAdmin.rpc('audience_in_active_use', {
    p_audience_id: payload.audience_id,
  });

  if (inUse === true) {
    const { data: usage } = await supabaseAdmin
      .from('meta_audience_usage')
      .select('adset_id, adset_name, adset_status, usage_kind')
      .eq('audience_id', payload.audience_id)
      .eq('adset_status', 'ACTIVE');

    return jsonResponse({
      ok: false,
      in_active_use: true,
      error: 'detach from active adsets first',
      adsets: usage ?? [],
    }, 422, cors);
  }

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-audience-delete',
        actionKind: 'delete_audience',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload: { audience_id: payload.audience_id, name: row.name, subtype: row.subtype },
        targetKind: 'audience',
        targetExternalId: row.external_id,
      },
      async () => {
        const url = `${GRAPH_BASE}/${row.external_id}?access_token=${encodeURIComponent(metaToken)}`;
        const r = await fetch(url, { method: 'DELETE' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new MetaApiError(
            j?.error?.message ?? 'meta_delete_failed',
            j?.error?.code ?? r.status,
            j?.error,
          );
        }

        const { error: delErr } = await supabaseAdmin
          .from('meta_audiences')
          .delete()
          .eq('id', payload.audience_id);

        if (delErr) {
          console.error('[meta-audience-delete] local delete failed', delErr);
        }

        return { ok: true, deleted_external_id: row.external_id, deleted_local_id: row.id };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_delete: { id: payload.audience_id, name: row.name },
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
