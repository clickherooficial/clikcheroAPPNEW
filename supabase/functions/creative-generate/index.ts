// creative-generate — Edge Function central de geracao de criativos por IA.
// Spec: .kiro/specs/ai-creative-generation/ (task 4.1 a 4.8)
//
// Pipeline:
//   1. CORS + method
//   2. Zod parsing -> GenerateRequest
//   3. Tenant guard (JWT -> company_id, user_id)
//   4. Idempotency: se idempotency_key ja existe, retorna response do row existente
//   5. Quota: get_creative_usage; status='blocked' -> 403
//   6. Briefing: get_company_briefing(purpose='creative-generation'); incomplete -> 422
//   7. GPT-image bloqueado em plano free -> 403
//   8. Compliance light pre: briefing_hits hard-block; baseline block_unless_override
//      -> 403 sem override; warn so passa
//   9. KB heuristica: concept com "depoimento|cliente|oferta" -> search_knowledge top_k=3
//  10. Monta prompt com briefing+paleta+logo+KB+negative_prompt
//  11. mode='adapt': baixa source bytes, reusa prompt do parent, override format
//  12. count clampado <=2 (R1.7); Promise.all callProviderWithFallback
//  13. Pos-geracao por imagem: dHash + lookup 30d + OCR
//  14. Upload bucket + INSERT creatives_generated/compliance_check/agent_runs
//  15. logCreativeAccess + GenerateResponse
//
// Contracts em design.md (linhas 248-282).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireTenant } from '../_shared/tenant-guard.ts';
import { logCreativeAccess } from '../_shared/log-redact.ts';
import { dhash, hammingDistance } from '../_shared/dhash.ts';
import {
  callProviderWithFallback,
  type AspectFormat,
  type ProviderModel,
  type ProviderInput,
} from '../_shared/creative-providers.ts';
import {
  checkComplianceText,
  runOcrCheck,
  type BlocklistTerm,
  type BriefingProhibitions,
} from '../_shared/creative-compliance.ts';

// ============================================================
// Constantes
// ============================================================
// 55s deixa margem confortavel antes do corte da plataforma (~150s wall clock,
// mas 504 EDGE_FUNCTION_ERROR ja apareceu em ~92s). Garante que sempre temos
// tempo de logar + retornar JSON estruturado pro chat formatar a mensagem.
const TOTAL_TIMEOUT_MS = 55_000;
const HASH_BLOCK_DISTANCE = 3;
const HASH_NEAR_DISTANCE = 8;
const DEDUPE_WINDOW_DAYS = 30;
const MAX_PARALLEL_COUNT = 2; // R1.7

// Heuristica simples para acionar KB (R1.3 / task 4.4)
const KB_TRIGGERS = [
  'depoimento', 'depoimentos', 'cliente', 'clientes', 'oferta',
  'social proof', 'caso de sucesso', 'review', 'avaliacao',
];

// ============================================================
// Tipos publicos
// ============================================================
const FormatEnum = z.enum(['feed_1x1', 'story_9x16', 'reels_4x5']);
const ModelEnum = z.enum(['auto', 'nano_banana', 'gpt_image']);
const ModeEnum = z.enum(['create', 'adapt']);
const StyleEnum = z.enum(['minimalista', 'cinematografico', 'clean', 'lifestyle', 'produto_em_uso']);

const GenerateRequestSchema = z.object({
  concept: z.string().min(3).max(2000),
  format: FormatEnum,
  count: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  style_hint: StyleEnum.optional(),
  use_logo: z.boolean().optional(),
  model: ModelEnum.optional(),
  mode: ModeEnum.optional(),
  source_creative_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  idempotency_key: z.string().min(8).max(128).optional(),
  override_briefing_warning: z.boolean().optional(),
  override_blocklist_warning: z.boolean().optional(),
}).refine(
  (v) => v.mode !== 'adapt' || !!v.source_creative_id,
  { message: 'source_creative_id obrigatorio quando mode=adapt' },
);

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

interface CreativeMetadata {
  id: string;
  signed_url: string;
  signed_url_expires_at: string;
  format: AspectFormat;
  model_used: 'gemini-2.5-flash-image' | 'gpt-image-1';
  cost_usd: number;
  width: number;
  height: number;
  is_near_duplicate: boolean;
  near_duplicate_of_id: string | null;
  compliance_warning: boolean;
}

interface GenerateResponse {
  creatives: CreativeMetadata[];
  failed_count: number;
  blocked_by_dedupe: number;
  warnings: string[];
}

// ============================================================
// Entry HTTP
// ============================================================
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405, cors);
  }

  const startedAt = Date.now();
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!openaiKey || !geminiKey) {
    return jsonResponse({ error: 'provider_keys_missing' }, 500, cors);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ============ 4.1 — Tenant guard + Zod
  const guard = await requireTenant(req, admin, { cors });
  if (!guard.ok) return guard.response;
  const { userId, companyId } = guard.value;

  let body: unknown;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'validation', issues: parsed.error.flatten() },
      422, cors,
    );
  }
  const reqBody = parsed.data;
  const useLogo = reqBody.use_logo ?? true;
  const model: ProviderModel | 'auto' = reqBody.model ?? 'auto';
  const mode = reqBody.mode ?? 'create';

  // ============ 4.1 — Idempotency
  if (reqBody.idempotency_key) {
    const { data: existing } = await admin
      .from('creatives_generated')
      .select('id')
      .eq('company_id', companyId)
      .eq('idempotency_key', reqBody.idempotency_key)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const cached = await buildResponseFromIds(admin, companyId, [existing.id as string]);
      return jsonResponse(cached, 200, cors);
    }
  }

  // ============ 4.2 — Quota check
  const { data: usage, error: usageErr } = await admin
    .rpc('get_creative_usage', { p_company_id: companyId });
  if (usageErr) {
    return jsonResponse({ error: 'usage_check_failed', detail: usageErr.message }, 500, cors);
  }
  if (usage?.status === 'blocked') {
    return jsonResponse(
      {
        error: 'quota_exceeded',
        dimensions: usage.blocked_dimensions ?? [],
        usage,
      },
      403, cors,
    );
  }
  const warnings: string[] = [];
  if (usage?.status === 'warning' && Array.isArray(usage.warning_dimensions)) {
    warnings.push(`Quota em alerta: ${usage.warning_dimensions.join(', ')}`);
  }

  // ============ 4.2 — Briefing completeness
  const { data: briefing, error: briefErr } = await admin
    .rpc('get_company_briefing', {
      p_company_id: companyId,
      p_purpose: 'creative-generation',
    });
  if (briefErr) {
    return jsonResponse({ error: 'briefing_failed', detail: briefErr.message }, 500, cors);
  }
  if (!briefing || briefing.isComplete !== true) {
    return jsonResponse(
      {
        error: 'briefing_incomplete',
        missingFields: briefing?.missingFields ?? [],
        score: briefing?.completenessScore ?? 0,
      },
      422, cors,
    );
  }

  // ============ 4.2 — Plan free + gpt_image guard (R6.7)
  const { data: planInfo } = await admin
    .from('companies')
    .select('id, organization:organizations(plan)')
    .eq('id', companyId)
    .single();
  const plan = (planInfo as { organization?: { plan?: string } } | null)
    ?.organization?.plan ?? 'free';

  if (plan === 'free' && reqBody.model === 'gpt_image') {
    return jsonResponse(
      {
        error: 'plan_upgrade_required',
        message: 'GPT-image-1 requer plano Pro ou superior. Use Nano Banana ou faca upgrade.',
      },
      403, cors,
    );
  }

  // ============ 4.3 — Compliance pre-geracao
  const { data: blocklistRows } = await admin
    .from('meta_baseline_blocklist')
    .select('term, category, severity');
  const blocklist = (blocklistRows ?? []) as BlocklistTerm[];

  const prohibitions: BriefingProhibitions = {
    words: extractStringArr(briefing?.prohibitions?.words),
    topics: extractStringArr(briefing?.prohibitions?.topics),
    visualRules: extractStringArr(briefing?.prohibitions?.visualRules),
  };

  const complianceText = checkComplianceText(
    reqBody.concept,
    undefined,
    prohibitions,
    blocklist,
  );

  if (complianceText.hard_block) {
    logCreativeAccess({
      companyId, userId, event: mode === 'adapt' ? 'adapt' : 'generate',
      status: 'failed', errorKind: 'forbidden_by_briefing',
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(
      {
        error: 'forbidden_by_briefing',
        hits: complianceText.briefing_hits,
      },
      403, cors,
    );
  }
  if (complianceText.requires_override && !reqBody.override_blocklist_warning) {
    logCreativeAccess({
      companyId, userId, event: mode === 'adapt' ? 'adapt' : 'generate',
      status: 'failed', errorKind: 'forbidden_by_blocklist',
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(
      {
        error: 'forbidden_by_blocklist',
        hits: complianceText.baseline_hits,
        message: 'Termos sensiveis detectados. Reenvie com override_blocklist_warning=true para confirmar.',
      },
      403, cors,
    );
  }

  // ============ 4.4 — KB context (heuristica)
  const triggerKb = KB_TRIGGERS.some((kw) => reqBody.concept.toLowerCase().includes(kw));
  const kbContext: { chunkIds: string[]; snippets: string[] } = { chunkIds: [], snippets: [] };
  if (triggerKb) {
    try {
      const embResp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: reqBody.concept }),
      });
      if (embResp.ok) {
        const embJson = await embResp.json();
        const queryEmbedding = embJson.data?.[0]?.embedding;
        if (Array.isArray(queryEmbedding)) {
          const { data: kbRows } = await admin.rpc('search_knowledge', {
            p_company_id: companyId,
            p_query_embedding: queryEmbedding,
            p_top_k: 3,
            p_filters: {},
            p_query_preview: reqBody.concept.slice(0, 200),
          });
          for (const row of (kbRows ?? []) as Array<{ chunk_id: string; chunk_text: string }>) {
            kbContext.chunkIds.push(row.chunk_id);
            const snippet = row.chunk_text.slice(0, 280).replace(/\s+/g, ' ');
            kbContext.snippets.push(snippet);
          }
        }
      }
    } catch (e) {
      console.warn('kb search failed (non-fatal):', (e as Error).message);
    }
  }

  // ============ 4.4/4.8 — adapt: baixa source + override prompt
  let sourcePromptOverride: string | null = null;
  let sourceConceptOverride: string | null = null;
  let parentBytesForAdapt: Uint8Array | undefined;
  let adaptationSetId: string | null = null;
  let parentCreativeId: string | null = null;

  if (mode === 'adapt') {
    const { data: source } = await admin
      .from('creatives_generated')
      .select('id, company_id, prompt, concept, storage_path, mime_type, adaptation_set_id')
      .eq('id', reqBody.source_creative_id)
      .single();
    if (!source || (source as { company_id: string }).company_id !== companyId) {
      return jsonResponse({ error: 'source_not_found' }, 404, cors);
    }
    const src = source as {
      id: string; prompt: string; concept: string;
      storage_path: string; mime_type: string;
      adaptation_set_id: string | null;
    };
    const { data: srcBlob, error: dlErr } = await admin.storage
      .from('generated-creatives').download(src.storage_path);
    if (dlErr || !srcBlob) {
      return jsonResponse({ error: 'source_download_failed' }, 500, cors);
    }
    parentBytesForAdapt = new Uint8Array(await srcBlob.arrayBuffer());
    sourcePromptOverride = src.prompt;
    sourceConceptOverride = src.concept;
    adaptationSetId = src.adaptation_set_id ?? src.id;
    parentCreativeId = src.id;
  }

  // ============ 4.4 — Logo bytes
  let logoBytes: Uint8Array | undefined;
  if (useLogo) {
    const logoPath = briefing?.visualIdentity?.logoPrimary?.storagePath
      ?? briefing?.visualIdentity?.logoAlt?.storagePath;
    if (typeof logoPath === 'string' && logoPath.length > 0) {
      const { data: logoBlob } = await admin.storage
        .from('company-assets').download(logoPath);
      if (logoBlob) {
        logoBytes = new Uint8Array(await logoBlob.arrayBuffer());
      }
    }
  }

  // ============ 4.5 — Routing model='auto'
  const concreteCount = Math.min(reqBody.count, MAX_PARALLEL_COUNT) as 1 | 2;
  const paletteDefined = Array.isArray(briefing?.visualIdentity?.palette)
    && briefing.visualIdentity.palette.length > 0;
  let resolvedModel: ProviderModel;
  if (model === 'auto') {
    // 2026-05-04: revertido pra nano_banana apos overnight test mostrar
    // gpt-image-1 estourando timeout 55s + retries em todos os runs. Nano Banana
    // (gemini-2.5-flash-image) volta a ser default; fallback automatico em
    // creative-providers.ts cobre 5xx/timeout pivotando pra gpt-image-1.
    resolvedModel = 'nano_banana';
  } else {
    resolvedModel = model;
  }
  // Reels (4:5) sempre Nano (R4.2 — provider abstraction tambem reforca)
  if (reqBody.format === 'reels_4x5') resolvedModel = 'nano_banana';

  // ============ 4.4 — Build prompt
  const promptText = sourcePromptOverride ?? buildPrompt({
    concept: reqBody.concept,
    style: reqBody.style_hint,
    briefing,
    kbSnippets: kbContext.snippets,
  });

  const negativePrompt = buildNegativePrompt(prohibitions, complianceText.baseline_hits);

  // ============ 4.5 — Pipeline paralelo com timeout total 60s
  const providerInput: Omit<ProviderInput, 'model'> = {
    prompt: promptText,
    format: reqBody.format,
    parentBytes: parentBytesForAdapt,
    logoBytes,
    negativePrompt,
  };

  const tasks: Promise<Awaited<ReturnType<typeof callProviderWithFallback>>>[] = [];
  for (let i = 0; i < concreteCount; i++) {
    tasks.push(
      callProviderWithFallback(
        { ...providerInput, model: resolvedModel },
        { openai: openaiKey, gemini: geminiKey },
      ),
    );
  }

  const totalTimeoutPromise = new Promise<'__timeout__'>((resolve) => {
    setTimeout(() => resolve('__timeout__'), TOTAL_TIMEOUT_MS);
  });
  const raceResult = await Promise.race([Promise.allSettled(tasks), totalTimeoutPromise]);
  if (raceResult === '__timeout__') {
    logCreativeAccess({
      companyId, userId, event: mode === 'adapt' ? 'adapt' : 'generate',
      status: 'failed', errorKind: 'timeout_total', count: concreteCount,
      modelUsed: resolvedModel, format: reqBody.format,
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: 'timeout_total' }, 504, cors);
  }
  const settled = raceResult;

  // ============ 4.6 — Pos-processamento
  const briefingSnapshot = redactSensitiveBriefing(briefing);
  const persisted: CreativeMetadata[] = [];
  let failedCount = 0;
  let blockedByDedupe = 0;
  const insertedIds: string[] = [];

  for (const r of settled) {
    if (r.status === 'rejected' || !r.value.ok) {
      failedCount++;
      const errKind = r.status === 'rejected'
        ? 'rejected'
        : (r.value as { error: { kind: string } }).error.kind;
      await insertAgentRun(admin, {
        companyId, userId,
        agentName: resolvedModel === 'gpt_image' ? 'creative-gpt-image' : 'creative-nano-banana',
        conversationId: reqBody.conversation_id ?? null,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        model: resolvedModel === 'gpt_image' ? 'gpt-image-1' : 'gemini-2.5-flash-image',
        errorMessage: errKind,
      });
      continue;
    }
    const ok = r.value;

    // dHash + dedupe
    let phash: string;
    try {
      phash = await dhash(ok.bytes);
    } catch (e) {
      console.warn('dhash failed:', (e as Error).message);
      failedCount++;
      continue;
    }

    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400_000).toISOString();
    const { data: hashCandidates } = await admin
      .from('creatives_generated')
      .select('id, phash')
      .eq('company_id', companyId)
      .gte('created_at', cutoff)
      .neq('status', 'discarded');

    let blockedDup = false;
    let nearDupId: string | null = null;
    let isNearDup = false;
    for (const cand of (hashCandidates ?? []) as Array<{ id: string; phash: string }>) {
      if (cand.phash?.length !== 16) continue;
      const dist = hammingDistance(phash, cand.phash);
      if (dist <= HASH_BLOCK_DISTANCE) {
        blockedDup = true;
        nearDupId = cand.id;
        break;
      }
      if (dist <= HASH_NEAR_DISTANCE && !isNearDup) {
        isNearDup = true;
        nearDupId = cand.id;
      }
    }

    if (blockedDup && nearDupId) {
      blockedByDedupe++;
      const cached = await buildResponseFromIds(admin, companyId, [nearDupId]);
      if (cached.creatives[0]) persisted.push(cached.creatives[0]);
      continue;
    }

    // OCR pos: SKIP temporario (2026-04-28 — gargalo de latency, refazer async)
    // Habilitar via env SKIP_CREATIVE_OCR=false
    const skipOcr = (Deno.env.get('SKIP_CREATIVE_OCR') ?? 'true').toLowerCase() !== 'false';
    const ocr = skipOcr
      ? { detected_text: '', ocr_hits: [], has_warning: false }
      : await runOcrCheck(ok.bytes, ok.mimeType, blocklist, openaiKey)
          .catch(() => ({ detected_text: '', ocr_hits: [], has_warning: false }));

    // Persist
    const newId = crypto.randomUUID();
    const ext = ok.mimeType === 'image/jpeg' ? 'jpg' : ok.mimeType === 'image/webp' ? 'webp' : 'png';
    const storagePath = `${companyId}/${newId}.${ext}`;

    const { error: upErr } = await admin.storage
      .from('generated-creatives')
      .upload(storagePath, ok.bytes, { contentType: ok.mimeType, upsert: false });
    if (upErr) {
      console.error('storage upload failed:', upErr.message);
      failedCount++;
      continue;
    }

    const { error: insErr } = await admin
      .from('creatives_generated')
      .insert({
        id: newId,
        company_id: companyId,
        conversation_id: reqBody.conversation_id ?? null,
        parent_creative_id: parentCreativeId,
        near_duplicate_of_id: isNearDup ? nearDupId : null,
        adaptation_set_id: adaptationSetId,
        idempotency_key: reqBody.idempotency_key ?? null,
        prompt: promptText,
        concept: sourceConceptOverride ?? reqBody.concept,
        format: reqBody.format,
        model_used: ok.modelUsed,
        provider_model_version: ok.modelUsed,
        status: 'generated',
        storage_path: storagePath,
        mime_type: ok.mimeType,
        width: ok.width,
        height: ok.height,
        cost_usd: ok.costUsd,
        latency_ms: ok.latencyMs,
        phash,
        is_near_duplicate: isNearDup,
        compliance_warning: ocr.has_warning,
        briefing_snapshot: briefingSnapshot,
        kb_chunk_ids: kbContext.chunkIds,
      });
    if (insErr) {
      console.error('insert creatives_generated failed:', insErr.message);
      // limpa storage para nao deixar orfao
      await admin.storage.from('generated-creatives').remove([storagePath]);
      failedCount++;
      continue;
    }

    // compliance row
    await admin.from('creative_compliance_check').insert({
      creative_id: newId,
      baseline_hits: complianceText.baseline_hits.map((h) => h.term),
      briefing_hits: complianceText.briefing_hits,
      ocr_hits: ocr.ocr_hits,
      passed: !complianceText.hard_block && !ocr.has_warning,
    });

    // agent_runs
    await insertAgentRun(admin, {
      companyId, userId,
      agentName: ok.modelUsed === 'gpt-image-1' ? 'creative-gpt-image' : 'creative-nano-banana',
      conversationId: reqBody.conversation_id ?? null,
      status: 'success',
      latencyMs: ok.latencyMs,
      costUsd: ok.costUsd,
      model: ok.modelUsed,
      metadata: { fallback_triggered: ok.fallbackTriggered, format: reqBody.format },
    });

    insertedIds.push(newId);

    // Signed URL
    const { data: signed } = await admin.storage
      .from('generated-creatives')
      .createSignedUrl(storagePath, 60 * 60); // 1h
    persisted.push({
      id: newId,
      signed_url: signed?.signedUrl ?? '',
      signed_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      format: reqBody.format,
      model_used: ok.modelUsed,
      cost_usd: ok.costUsd,
      width: ok.width,
      height: ok.height,
      is_near_duplicate: isNearDup,
      near_duplicate_of_id: isNearDup ? nearDupId : null,
      compliance_warning: ocr.has_warning,
    });
  }

  const totalDuration = Date.now() - startedAt;
  const finalStatus: 'success' | 'failed' | 'partial' =
    persisted.length === 0 ? 'failed'
    : failedCount === 0 ? 'success' : 'partial';

  logCreativeAccess({
    companyId, userId,
    event: mode === 'adapt' ? 'adapt' : 'generate',
    modelUsed: resolvedModel === 'gpt_image' ? 'gpt-image-1' : 'gemini-2.5-flash-image',
    format: reqBody.format,
    count: concreteCount,
    costUsd: persisted.reduce((s, c) => s + c.cost_usd, 0),
    durationMs: totalDuration,
    status: finalStatus,
  });

  if (persisted.length === 0) {
    return jsonResponse(
      {
        error: 'provider_unavailable',
        failed_count: failedCount,
        blocked_by_dedupe: blockedByDedupe,
      },
      503, cors,
    );
  }

  const response: GenerateResponse = {
    creatives: persisted,
    failed_count: failedCount,
    blocked_by_dedupe: blockedByDedupe,
    warnings,
  };
  return jsonResponse(response, 200, cors);
});

// ============================================================
// Helpers
// ============================================================

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function extractStringArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function buildPrompt(opts: {
  concept: string;
  style?: string;
  briefing: any;
  kbSnippets: string[];
}): string {
  const { concept, style, briefing, kbSnippets } = opts;
  const offer = briefing?.primaryOffer ?? {};
  const audience = briefing?.audience ?? {};
  const tone = briefing?.tone ?? {};
  const palette = briefing?.visualIdentity?.palette;

  const parts: string[] = [];
  parts.push(
    `Crie uma imagem de anuncio para o mercado brasileiro (alta qualidade, idioma portugues do Brasil em qualquer texto visivel). ` +
    `IMPORTANTE: TODO texto na imagem (titulos, CTAs, precos, headlines, badges, taglines) DEVE estar em portugues do Brasil. ` +
    `NUNCA use ingles. Ex: "BLACK FRIDAY" -> "BLACK FRIDAY" e aceito por ser termo cunhado, mas "Technology Consulting" deve ser "Consultoria de Tecnologia". ` +
    `Se nao foi pedido texto, nao adicione texto. Conceito: ${concept}`,
  );

  if (offer?.title || offer?.description) {
    parts.push(`Oferta: ${offer.title ?? ''}${offer.description ? ' — ' + offer.description : ''}`);
  }
  if (audience?.persona) {
    parts.push(`Publico: ${audience.persona}`);
  }
  if (audience?.painPoints && Array.isArray(audience.painPoints) && audience.painPoints.length) {
    parts.push(`Dores: ${audience.painPoints.slice(0, 3).join('; ')}`);
  }
  if (tone?.voice) {
    parts.push(`Tom: ${tone.voice}`);
  }
  if (style) {
    parts.push(`Estilo visual: ${style}`);
  }
  if (Array.isArray(palette) && palette.length > 0) {
    const hex = palette.filter((p: unknown) => typeof p === 'string').slice(0, 5).join(', ');
    if (hex) parts.push(`Paleta de cores (use estritamente): ${hex}`);
  }
  if (kbSnippets.length > 0) {
    parts.push(`Contexto adicional do cliente:\n${kbSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function buildNegativePrompt(
  prohibitions: BriefingProhibitions,
  baselineHits: { term: string }[],
): string {
  const items = [
    ...prohibitions.words,
    ...prohibitions.topics,
    ...prohibitions.visualRules,
    ...baselineHits.map((h) => h.term),
  ].filter(Boolean);
  return items.length > 0 ? items.join(', ') : '';
}

function redactSensitiveBriefing(briefing: any): Record<string, unknown> {
  // Snapshot reduzido: campos chave de reproducibilidade sem expor dado sensivel pro storage.
  return {
    isComplete: briefing?.isComplete ?? false,
    completenessScore: briefing?.completenessScore ?? 0,
    primaryOfferTitle: briefing?.primaryOffer?.title ?? null,
    audiencePersona: briefing?.audience?.persona ?? null,
    toneVoice: briefing?.tone?.voice ?? null,
    palette: briefing?.visualIdentity?.palette ?? null,
    capturedAt: new Date().toISOString(),
  };
}

async function insertAgentRun(
  admin: SupabaseClient,
  meta: {
    companyId: string;
    userId: string;
    agentName: string;
    conversationId: string | null;
    status: 'success' | 'error' | 'partial';
    latencyMs: number;
    costUsd: number;
    model: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from('agent_runs').insert({
    company_id: meta.companyId,
    user_id: meta.userId,
    agent_name: meta.agentName,
    conversation_id: meta.conversationId,
    status: meta.status,
    finished_at: new Date().toISOString(),
    latency_ms: meta.latencyMs,
    model: meta.model,
    cost_usd: meta.costUsd,
    error_message: meta.errorMessage ?? null,
    metadata: meta.metadata ?? {},
  });
}

async function buildResponseFromIds(
  admin: SupabaseClient,
  companyId: string,
  ids: string[],
): Promise<GenerateResponse> {
  const { data: rows } = await admin
    .from('creatives_generated')
    .select('id, format, model_used, cost_usd, width, height, is_near_duplicate, near_duplicate_of_id, compliance_warning, storage_path')
    .eq('company_id', companyId)
    .in('id', ids);

  const creatives: CreativeMetadata[] = [];
  for (const r of (rows ?? []) as Array<{
    id: string; format: AspectFormat; model_used: 'gemini-2.5-flash-image' | 'gpt-image-1';
    cost_usd: number; width: number; height: number;
    is_near_duplicate: boolean; near_duplicate_of_id: string | null;
    compliance_warning: boolean; storage_path: string;
  }>) {
    const { data: signed } = await admin.storage
      .from('generated-creatives').createSignedUrl(r.storage_path, 60 * 60);
    creatives.push({
      id: r.id,
      signed_url: signed?.signedUrl ?? '',
      signed_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      format: r.format,
      model_used: r.model_used,
      cost_usd: r.cost_usd,
      width: r.width,
      height: r.height,
      is_near_duplicate: r.is_near_duplicate,
      near_duplicate_of_id: r.near_duplicate_of_id,
      compliance_warning: r.compliance_warning,
    });
  }
  return { creatives, failed_count: 0, blocked_by_dedupe: 0, warnings: [] };
}
