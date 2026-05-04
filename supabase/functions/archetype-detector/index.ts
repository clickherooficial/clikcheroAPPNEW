// Edge Function: archetype-detector (Task 3.4)
// Spec: business-archetype-personas
//
// Endpoint POST que detecta o `business_archetype` de uma company a partir
// do briefing + oferta primaria, e persiste em `company_briefings`.
//
// Idempotencia (R2.5): se business_archetype ja esta setado, retorna
// `method: 'skipped'` SEM chamar LLM. Pra forcar redetect, o usuario
// deve setar pra NULL via Settings UI primeiro.
//
// Feature flag (R8.4): se ENABLE_ARCHETYPE_PERSONAS == 'false', retorna
// no-op imediato com `method: 'disabled'`.
//
// Auth: verify_jwt = false no config.toml. Validamos presenca do header
// Authorization e usamos client com user JWT pra reusar RLS na leitura
// de briefing/offers. UPDATE usa service_role (briefing pode ter RLS
// restritiva pra writes diretos).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { detectArchetype, isArchetype, type DetectorInput, type PrimaryOfferFormat } from '../_shared/archetype-detector.ts';

function jsonResponse(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, cors);
  }

  const t0 = Date.now();

  try {
    // ---- Feature flag ----
    if (Deno.env.get('ENABLE_ARCHETYPE_PERSONAS') === 'false') {
      return jsonResponse(200, { archetype: null, method: 'disabled' }, cors);
    }

    // ---- Auth ----
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization' }, cors);
    }

    // ---- Body ----
    let body: { company_id?: unknown };
    try { body = await req.json(); } catch {
      return jsonResponse(400, { error: 'Invalid JSON' }, cors);
    }
    const companyId = body.company_id;
    if (typeof companyId !== 'string' || companyId.length === 0) {
      return jsonResponse(400, { error: 'company_id required (string)' }, cors);
    }

    // ---- Clients ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Read briefing (RLS via user JWT) ----
    const { data: briefing, error: briefErr } = await supabaseUser
      .from('company_briefings')
      .select('business_archetype, niche, niche_category, short_description')
      .eq('company_id', companyId)
      .maybeSingle();

    if (briefErr) {
      console.error('[archetype-detector] briefing read error', briefErr);
      return jsonResponse(500, { error: 'Failed to read briefing' }, cors);
    }
    if (!briefing) {
      return jsonResponse(404, { error: 'Briefing not found for company' }, cors);
    }

    // ---- Idempotencia (R2.5) ----
    const existing = (briefing as { business_archetype: unknown }).business_archetype;
    if (isArchetype(existing)) {
      return jsonResponse(200, {
        archetype: existing,
        method: 'skipped',
        confidence: 1,
      }, cors);
    }

    // ---- Read primary offer format (RLS via user JWT) ----
    let primaryOfferFormat: PrimaryOfferFormat | null = null;
    const { data: offer, error: offerErr } = await supabaseUser
      .from('company_offers')
      .select('format')
      .eq('company_id', companyId)
      .eq('is_primary', true)
      .maybeSingle();

    if (offerErr) {
      // Nao bloqueante: log + segue sem o sinal
      console.warn('[archetype-detector] offer read warn', offerErr);
    }
    if (offer && typeof (offer as { format: unknown }).format === 'string') {
      const f = (offer as { format: string }).format;
      if (f === 'course' || f === 'service' || f === 'physical' || f === 'saas' || f === 'other') {
        primaryOfferFormat = f;
      }
    }

    // ---- Detect ----
    const input: DetectorInput = {
      niche: (briefing as { niche: string | null }).niche,
      niche_category: (briefing as { niche_category: string | null }).niche_category,
      short_description: (briefing as { short_description: string | null }).short_description,
      primary_offer_format: primaryOfferFormat,
    };

    const result = await detectArchetype(input);

    // ---- Persist (only if classified) ----
    if (result.archetype !== null) {
      const { error: updErr } = await supabaseAdmin
        .from('company_briefings')
        .update({ business_archetype: result.archetype })
        .eq('company_id', companyId);
      if (updErr) {
        console.error('[archetype-detector] update error', updErr);
        // Loga, mas ainda retorna o archetype detectado pro caller
      }
    }

    // ---- Telemetria em agent_runs ----
    const latencyMs = Date.now() - t0;
    try {
      await supabaseAdmin.from('agent_runs').insert({
        company_id: companyId,
        agent_name: 'archetype-detector',
        status: result.method === 'failed' ? 'error' : 'success',
        started_at: new Date(t0).toISOString(),
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        model: result.method === 'llm' ? 'gpt-4o-mini' : null,
        metadata: {
          method: result.method,
          confidence: result.confidence,
          archetype: result.archetype,
        },
      });
    } catch (telErr) {
      console.warn('[archetype-detector] agent_runs insert failed', telErr);
    }

    return jsonResponse(200, {
      archetype: result.archetype,
      method: result.method,
      confidence: result.confidence,
    }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[archetype-detector] unhandled error', msg);
    return jsonResponse(500, { error: 'Internal error' }, cors);
  }
});
