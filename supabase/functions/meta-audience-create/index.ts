// meta-audience-create — audience-management (Sprint 3/8)
// Cria Custom Audience a partir de lista de clientes (CSV ja hashed SHA256 client-side).
// Wrap em withSafetyRails — sandbox simula sem chamar Meta.
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
import { uploadUsersInBatches } from '../_shared/audience-helpers.ts';
import { withSafetyRails } from '../_shared/safety-rails.ts';

const SHA256_HEX = /^[a-f0-9]{64}$/;

const PayloadSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(255).optional(),
  customer_file_source: z.enum([
    'USER_PROVIDED_ONLY',
    'PARTNER_PROVIDED_ONLY',
    'BOTH_USER_AND_PARTNER_PROVIDED',
  ]).default('USER_PROVIDED_ONLY'),
  payload: z.object({
    schema: z.array(z.enum(['EMAIL', 'PHONE', 'FN', 'LN', 'GEN', 'DOBY', 'COUNTRY'])).min(1),
    data: z.array(z.array(z.string().regex(SHA256_HEX, 'must_be_sha256_hex'))).min(1),
  }),
  retention_days: z.number().int().min(1).max(540).default(180),
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
  const { companyId, userId, adAccountId, metaToken } = ctx.value;

  let payload: z.infer<typeof PayloadSchema>;
  try {
    payload = PayloadSchema.parse(await req.json());
  } catch (e: any) {
    return jsonResponse({ error: 'invalid_payload', detail: e?.errors ?? e?.message }, 400, cors);
  }

  // garantir que cada row tem mesma cardinalidade que schema
  for (const row of payload.payload.data) {
    if (row.length !== payload.payload.schema.length) {
      return jsonResponse({ error: 'row_length_mismatch_schema' }, 400, cors);
    }
  }

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName: 'meta-audience-create',
        actionKind: 'create_audience',
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload: {
          name: payload.name,
          rows: payload.payload.data.length,
          schema: payload.payload.schema,
        }, // NUNCA loga payload.data (mesmo hashed)
        targetKind: 'audience',
      },
      async () => {
        // 1. cria audiencia vazia
        const created = await metaPatch(`${adAccountId}/customaudiences`, {
          name: payload.name,
          description: payload.description ?? '',
          subtype: 'CUSTOM',
          customer_file_source: payload.customer_file_source,
          retention_days: payload.retention_days,
        }, metaToken);

        if (!created.id) throw new Error('audience_create_no_id');

        // 2. upload em batches
        const upload = await uploadUsersInBatches(
          String(created.id),
          payload.payload,
          metaToken,
        );

        // 3. insert local
        const { data: localRow, error: insErr } = await supabaseAdmin
          .from('meta_audiences')
          .insert({
            company_id: companyId,
            external_id: String(created.id),
            name: payload.name,
            description: payload.description ?? null,
            subtype: 'CUSTOM',
            retention_days: payload.retention_days,
            delivery_status: { code: 0, description: 'processing' },
            local_updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insErr) {
          console.error('[meta-audience-create] local insert failed', insErr);
        }

        return {
          ok: true,
          audience_id: localRow?.id ?? null,
          external_id: String(created.id),
          batches: upload.batches,
          rows: upload.total_rows,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_create_audience: { name: payload.name, rows: payload.payload.data.length },
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
