// Edge Function: archetype-backfill (Tasks 4.1, 4.2)
// Spec: business-archetype-personas
//
// One-shot operacional para classificar briefings legados que estao com
// status='complete' e business_archetype IS NULL.
//
// Idempotente: cada batch re-le o estado atual, entao nunca processa o
// mesmo company_id duas vezes (uma vez classificado, sai do filtro).
//
// Reuso: importa `detectArchetype` direto de `_shared/archetype-detector.ts`
// em vez de fazer round-trip HTTP pra propria edge function archetype-detector.
// Decisao: chamada direta evita auth interno + reduz latencia (~200-500ms por
// row eliminados) + simplifica error handling.
//
// Auth: protegida por SERVICE_ROLE_KEY no header Authorization. Esta e uma
// fn admin/operacional, NAO chamada do FE. verify_jwt = false no config.toml
// (a validacao e feita aqui no codigo).
//
// Query de cobertura (rodar via Management API quando precisar verificar):
//   SELECT business_archetype, COUNT(*)
//   FROM company_briefings
//   WHERE status='complete'
//   GROUP BY business_archetype;
//
// Tratamento de deteccao cronica (Task 9.4 — Req 8.3):
// Ao final de cada execucao, varremos `agent_runs` (ultimos 7 dias) procurando
// company_ids com 3+ falhas do `archetype-detector`. Cada um vira 1 row warning
// em `agent_runs` com `error_message` destacado. Deteccoes cronicas (3+ falhas/7d)
// ficam destacadas em agent_runs.error_message. Usuario NAO e bloqueado —
// fallback Fase 1 (sem persona) cobre sempre. E so um sinal pra investigacao
// manual ou pra UX sugerir setar archetype manualmente em Settings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  detectArchetype,
  type DetectorInput,
  type PrimaryOfferFormat,
} from '../_shared/archetype-detector.ts';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_TOTAL = 1000;
const SLEEP_BETWEEN_BATCHES_MS = 6000;

function jsonResponse(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrimaryOfferFormat(v: unknown): v is PrimaryOfferFormat {
  return v === 'course' || v === 'service' || v === 'physical' || v === 'saas' || v === 'other';
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, cors);
  }

  const t0 = Date.now();

  try {
    // ---- Auth: exige SERVICE_ROLE_KEY ----
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!serviceKey || !bearer || bearer !== serviceKey) {
      return jsonResponse(401, { error: 'Unauthorized' }, cors);
    }

    // ---- Body opcional ----
    let body: { batch_size?: unknown; max_total?: unknown } = {};
    if (req.headers.get('content-length') !== '0') {
      try {
        body = await req.json();
      } catch {
        // body opcional — ignora parse fail
        body = {};
      }
    }
    const batchSize = (() => {
      const v = body.batch_size;
      if (typeof v === 'number' && v > 0 && v <= 100) return Math.floor(v);
      return DEFAULT_BATCH_SIZE;
    })();
    const maxTotal = (() => {
      const v = body.max_total;
      if (typeof v === 'number' && v > 0 && v <= 100000) return Math.floor(v);
      return DEFAULT_MAX_TOTAL;
    })();

    // ---- Client service_role (bypass RLS) ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let totalProcessed = 0;
    let totalClassified = 0;
    let totalFailed = 0;
    let batchCount = 0;

    while (totalProcessed < maxTotal) {
      const remaining = maxTotal - totalProcessed;
      const limit = Math.min(batchSize, remaining);

      const { data: rows, error: selErr } = await supabaseAdmin
        .from('company_briefings')
        .select('company_id, niche, niche_category, short_description')
        .eq('status', 'complete')
        .is('business_archetype', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (selErr) {
        console.error('[archetype-backfill] select error', selErr);
        break;
      }
      if (!rows || rows.length === 0) {
        break; // nada pendente
      }

      batchCount++;

      for (const row of rows) {
        const companyId = (row as { company_id: string }).company_id;
        if (!companyId) {
          totalFailed++;
          totalProcessed++;
          continue;
        }

        // Le primary offer format (best-effort, nao bloqueante)
        let primaryOfferFormat: PrimaryOfferFormat | null = null;
        try {
          const { data: offer } = await supabaseAdmin
            .from('company_offers')
            .select('format')
            .eq('company_id', companyId)
            .eq('is_primary', true)
            .maybeSingle();
          if (offer && isPrimaryOfferFormat((offer as { format: unknown }).format)) {
            primaryOfferFormat = (offer as { format: PrimaryOfferFormat }).format;
          }
        } catch (offerErr) {
          console.warn('[archetype-backfill] offer read warn', { companyId, offerErr });
        }

        const input: DetectorInput = {
          niche: (row as { niche: string | null }).niche,
          niche_category: (row as { niche_category: string | null }).niche_category,
          short_description: (row as { short_description: string | null }).short_description,
          primary_offer_format: primaryOfferFormat,
        };

        try {
          const result = await detectArchetype(input);

          if (result.archetype !== null) {
            const { error: updErr } = await supabaseAdmin
              .from('company_briefings')
              .update({ business_archetype: result.archetype })
              .eq('company_id', companyId);
            if (updErr) {
              console.error('[archetype-backfill] update error', { companyId, updErr });
              totalFailed++;
            } else {
              totalClassified++;
            }
          } else {
            totalFailed++;
          }
        } catch (detectErr) {
          console.error('[archetype-backfill] detect error', { companyId, detectErr });
          totalFailed++;
        }

        totalProcessed++;
        if (totalProcessed >= maxTotal) break;
      }

      // Se rodada veio com menos que o limit, nao tem mais — sai antes do sleep
      if (rows.length < limit) break;
      if (totalProcessed >= maxTotal) break;

      // Rate limit conservador entre lotes (R7.2)
      await sleep(SLEEP_BETWEEN_BATCHES_MS);
    }

    const latencyMs = Date.now() - t0;

    // ---- Telemetria em agent_runs ----
    try {
      await supabaseAdmin.from('agent_runs').insert({
        agent_name: 'archetype-backfill',
        status: 'success',
        started_at: new Date(t0).toISOString(),
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        metadata: {
          totalProcessed,
          totalClassified,
          totalFailed,
          batches: batchCount,
          batch_size: batchSize,
          max_total: maxTotal,
        },
      });
    } catch (telErr) {
      console.warn('[archetype-backfill] agent_runs insert failed', telErr);
    }

    // ---- Task 9.4: tratamento de deteccao cronica falhada ----
    // Procura company_ids que tiveram 3+ falhas do archetype-detector
    // nos ultimos 7 dias. Cada um vira 1 warning em agent_runs.
    // NAO bloqueia usuario — fallback Fase 1 e sempre seguro.
    let chronicFailures = 0;
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: failRuns, error: failErr } = await supabaseAdmin
        .from('agent_runs')
        .select('metadata')
        .eq('agent_name', 'archetype-detector')
        .eq('status', 'error')
        .gte('started_at', sevenDaysAgo);

      if (failErr) {
        console.warn('[archetype-backfill] chronic query error', failErr);
      } else if (failRuns && failRuns.length > 0) {
        // Agrega por company_id em memoria (PostgREST nao suporta GROUP BY direto)
        const counts = new Map<string, number>();
        for (const r of failRuns) {
          const md = (r as { metadata: unknown }).metadata as { company_id?: unknown } | null;
          const cid = md && typeof md.company_id === 'string' ? md.company_id : null;
          if (!cid) continue;
          counts.set(cid, (counts.get(cid) ?? 0) + 1);
        }
        for (const [companyId, failCount] of counts.entries()) {
          if (failCount < 3) continue;
          chronicFailures++;
          try {
            await supabaseAdmin.from('agent_runs').insert({
              agent_name: 'archetype-backfill',
              status: 'error',
              started_at: new Date().toISOString(),
              finished_at: new Date().toISOString(),
              latency_ms: 0,
              error_message:
                'Deteccao cronica falhada — 3+ tentativas null em 7 dias. Usuario pode setar manualmente em Settings.',
              metadata: {
                chronic_failure: true,
                fail_count: failCount,
                company_id: companyId,
              },
            });
          } catch (insErr) {
            console.warn('[archetype-backfill] chronic warn insert failed', { companyId, insErr });
          }
        }
      }
    } catch (chronicErr) {
      console.warn('[archetype-backfill] chronic detection error', chronicErr);
    }

    return jsonResponse(200, {
      totalProcessed,
      totalClassified,
      totalFailed,
      batches: batchCount,
      chronic_failures: chronicFailures,
      latency_ms: latencyMs,
    }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[archetype-backfill] unhandled error', msg);
    return jsonResponse(500, { error: 'Internal error' }, cors);
  }
});
