// meta-audience-create-rule — pixel-engagement-audiences (Sprint 4/8)
// Cria Pixel ou Engagement Custom Audience via discriminated union.
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
import { withSafetyRails } from '../_shared/safety-rails.ts';
import {
  buildPixelRule,
  buildEngagementRule,
  pixelAudienceSubtype,
  engagementAudienceSubtype,
} from '../_shared/audience-rule-builder.ts';

const PixelInput = z.object({
  kind: z.literal('pixel'),
  name: z.string().min(1).max(80),
  pixel_id: z.string().min(1),
  event: z.enum([
    'PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration',
    'ViewContent', 'AddPaymentInfo', 'InitiateCheckout', 'Search', 'Subscribe',
  ]),
  url_contains: z.string().optional(),
  retention_days: z.number().int().min(1).max(180).default(30),
  exclude_event: z.enum([
    'PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration',
    'ViewContent', 'AddPaymentInfo', 'InitiateCheckout', 'Search', 'Subscribe',
  ]).optional(),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
});

const EngagementInput = z.object({
  kind: z.literal('engagement'),
  name: z.string().min(1).max(80),
  source_kind: z.enum(['page', 'ig_business', 'video', 'lead_form', 'event']),
  source_id: z.string().min(1),
  template: z.enum([
    'page_engaged_users', 'page_visitors',
    'video_viewers_25_pct', 'video_viewers_50_pct', 'video_viewers_75_pct', 'video_viewers_95_pct',
    'video_viewers_3_seconds', 'video_viewers_10_seconds',
    'lead_form_opened', 'lead_form_submitted',
    'event_responded', 'event_attended',
  ]),
  retention_days: z.number().int().min(1).max(365).default(180),
  triggered_by: z.enum(['user', 'agent', 'rule', 'plan']).default('user'),
});

const PayloadSchema = z.discriminatedUnion('kind', [PixelInput, EngagementInput]);

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

  const isPixel = payload.kind === 'pixel';
  const subtype = isPixel ? pixelAudienceSubtype() : engagementAudienceSubtype();
  const localSubtype = isPixel ? 'WEBSITE' : 'ENGAGEMENT';
  const rule = isPixel ? buildPixelRule(payload) : buildEngagementRule(payload);
  const actionKind = isPixel ? 'create_pixel_audience' : 'create_engagement_audience';
  const agentName = isPixel ? 'meta-audience-create-pixel' : 'meta-audience-create-engagement';

  try {
    const { result, gate, ledgerId, executed, simulated } = await withSafetyRails(
      supabaseAdmin,
      {
        companyId,
        agentName,
        actionKind,
        costBrlEstimate: 0,
        triggeredBy: payload.triggered_by,
        triggeredById: userId,
        payload,
        targetKind: 'audience',
      },
      async () => {
        const created = await metaPatch(`${adAccountId}/customaudiences`, {
          name: payload.name,
          subtype,
          rule,
        }, metaToken);

        if (!created.id) throw new Error('audience_create_no_id');

        const { data: localRow, error: insErr } = await supabaseAdmin
          .from('meta_audiences')
          .insert({
            company_id: companyId,
            external_id: String(created.id),
            name: payload.name,
            subtype: localSubtype,
            retention_days: payload.retention_days,
            rule,
            local_updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insErr) console.error('[create-rule] local insert failed', insErr);

        return {
          ok: true,
          audience_id: localRow?.id ?? null,
          external_id: String(created.id),
          subtype: localSubtype,
        };
      },
    );

    if (!executed) {
      if (simulated) {
        return jsonResponse({
          ok: true,
          sandbox: true,
          simulated: true,
          would_create: payload,
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
