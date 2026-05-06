// creative-iterate — Img2img a partir de criativo parent.
// Spec: .kiro/specs/ai-creative-generation/ (task 5.1, 5.2)
//
// Modes:
//   - 'iterate'    -> reusa parent.prompt + diff em instruction (default)
//   - 'regenerate' -> reusa parent.prompt sem instruction
//   - 'vary'       -> 3 imagens com CONCEITOS distintos (prompts por angulo; item 9)
//
// Pipeline:
//   1. Tenant guard
//   2. Zod parse IterateRequest
//   3. Fetch parent + valida company match
//   4. Quota check
//   5. Compliance light em (parent.concept + instruction)
//   6. Download parent bytes (servidor de imagem para provider)
//   7. Provider call com parentBytes preenchido (img2img)
//   8. Pos-processamento: dHash + OCR
//   9. Persist + linka parent_creative_id
//  10. iteration_warning se chain depth >= 5

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
} from '../_shared/creative-providers.ts';
import {
  checkComplianceText,
  runOcrCheck,
  type BlocklistTerm,
  type BriefingProhibitions,
} from '../_shared/creative-compliance.ts';

// Mesma logica do creative-generate: margem antes do corte da plataforma.
const TOTAL_TIMEOUT_MS = 85_000;
const HASH_BLOCK_DISTANCE = 3;
const HASH_NEAR_DISTANCE = 8;
const DEDUPE_WINDOW_DAYS = 30;
const MAX_PARALLEL_COUNT = 3;
const ITERATION_WARNING_THRESHOLD = 5;

const ModelEnum = z.enum(['auto', 'nano_banana', 'gpt_image']);
const IterateModeEnum = z.enum(['iterate', 'regenerate', 'vary']);

const IterateRequestSchema = z.object({
  parent_creative_id: z.string().uuid(),
  instruction: z.string().max(2000).optional(),
  mode: IterateModeEnum.optional(),
  count: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  model: ModelEnum.optional(),
  override_blocklist_warning: z.boolean().optional(),
});

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

interface IterateResponse {
  creatives: CreativeMetadata[];
  failed_count: number;
  blocked_by_dedupe: number;
  warnings: string[];
  iteration_warning?: string;
}

/** Angulos em PT-BR: cada variacao pede conceito/mensagem bem diferente (item 9). */
const VARY_CONCEPT_ANGLES_PT: readonly string[] = [
  'Perspectiva A: destaque FORTE problema/dor/transformacao antes-de-depois; composicao e copy novos.',
  'Perspectiva B: beneficio emocional + prova social (depoimento ficticio estilizado OU selo garantia); layout e cores distintos.',
  'Perspectiva C: novo enquadramento de cena (novo fundo, novo angulo de camera, hierarquia tipografica outra); mesmo produto/servico.',
];

function truncateForConcept(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildTaskPrompt(
  mode: z.infer<typeof IterateModeEnum>,
  parent: { prompt: string; concept: string },
  taskIndex: number,
  taskTotal: number,
  instruction: string | undefined,
): string {
  if (mode === 'regenerate') {
    return parent.prompt;
  }
  if (mode === 'vary') {
    const angle = VARY_CONCEPT_ANGLES_PT[taskIndex % VARY_CONCEPT_ANGLES_PT.length];
    const base = parent.prompt.trim();
    const conceptHint = parent.concept?.trim()
      ? `\nNegocio/oferta (manter o mesmo produto/servico, nao mudar marca): ${parent.concept.trim()}`
      : '';
    return `${base}${conceptHint}\n\n---\nVARIACAO ${taskIndex + 1}/${taskTotal} — CONCEITO E IMAGEM BEM DIFERENTES (obrigatorio)\nAngulo criativo: ${angle}\nRegras: nova composicao visual, nova hierarquia, nova mensagem principal. PROIBIDO resultado quase-identico ao criativo de referencia (nao basta filtro, brilho ou pequeno crop). Trate como briefing de anuncio novo reutilizando apenas a mesma oferta/marca.\nUse a imagem de referencia como guia de marca/produto, mas pode REENQUADRAR tudo diferente.`;
  }
  return `${parent.prompt}\n\nMudanca solicitada: ${instruction ?? ''}`;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405, cors);

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

  const guard = await requireTenant(req, admin, { cors });
  if (!guard.ok) return guard.response;
  const { userId, companyId } = guard.value;

  let body: unknown;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }
  const parsed = IterateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'validation', issues: parsed.error.flatten() }, 422, cors);
  }
  const reqBody = parsed.data;
  const mode = reqBody.mode ?? 'iterate';
  const count = (mode === 'vary' ? 3 : (reqBody.count ?? 1)) as 1 | 2 | 3;
  const concreteCount = Math.min(count, MAX_PARALLEL_COUNT) as 1 | 2 | 3;

  // Fetch parent + valida tenant
  const { data: parentRow, error: parentErr } = await admin
    .from('creatives_generated')
    .select('id, company_id, prompt, concept, format, storage_path, mime_type, conversation_id')
    .eq('id', reqBody.parent_creative_id)
    .single();
  if (parentErr || !parentRow) {
    return jsonResponse({ error: 'parent_not_found' }, 404, cors);
  }
  const parent = parentRow as {
    id: string; company_id: string; prompt: string; concept: string;
    format: AspectFormat; storage_path: string; mime_type: string;
    conversation_id: string | null;
  };
  if (parent.company_id !== companyId) {
    return jsonResponse({ error: 'parent_not_found' }, 404, cors);
  }

  // Quota check
  const { data: usage, error: usageErr } = await admin
    .rpc('get_creative_usage', { p_company_id: companyId });
  if (usageErr) return jsonResponse({ error: 'usage_check_failed' }, 500, cors);
  if (usage?.status === 'blocked') {
    return jsonResponse(
      { error: 'quota_exceeded', dimensions: usage.blocked_dimensions ?? [], usage },
      403, cors,
    );
  }
  const warnings: string[] = [];
  if (usage?.status === 'warning' && Array.isArray(usage.warning_dimensions)) {
    warnings.push(`Quota em alerta: ${usage.warning_dimensions.join(', ')}`);
  }

  // Compliance check em concept + instruction
  const { data: blocklistRows } = await admin
    .from('meta_baseline_blocklist').select('term, category, severity');
  const blocklist = (blocklistRows ?? []) as BlocklistTerm[];

  // Briefing apenas para prohibitions (compliance)
  const { data: briefing } = await admin
    .rpc('get_company_briefing', {
      p_company_id: companyId,
      p_purpose: 'creative-generation',
    });
  const prohibitions: BriefingProhibitions = {
    words: extractStringArr(briefing?.prohibitions?.words),
    topics: extractStringArr(briefing?.prohibitions?.topics),
    visualRules: extractStringArr(briefing?.prohibitions?.visualRules),
  };

  const complianceText = checkComplianceText(
    parent.concept, reqBody.instruction, prohibitions, blocklist,
  );
  if (complianceText.hard_block) {
    logCreativeAccess({
      companyId, userId, event: mode === 'vary' ? 'vary' : 'iterate',
      status: 'failed', errorKind: 'forbidden_by_briefing',
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(
      { error: 'forbidden_by_briefing', hits: complianceText.briefing_hits },
      403, cors,
    );
  }
  if (complianceText.requires_override && !reqBody.override_blocklist_warning) {
    logCreativeAccess({
      companyId, userId, event: mode === 'vary' ? 'vary' : 'iterate',
      status: 'failed', errorKind: 'forbidden_by_blocklist',
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(
      {
        error: 'forbidden_by_blocklist',
        hits: complianceText.baseline_hits,
        message: 'Termos sensiveis. Reenvie com override_blocklist_warning=true.',
      },
      403, cors,
    );
  }

  // Download parent bytes
  const { data: parentBlob, error: dlErr } = await admin.storage
    .from('generated-creatives').download(parent.storage_path);
  if (dlErr || !parentBlob) {
    return jsonResponse({ error: 'parent_download_failed' }, 500, cors);
  }
  const parentBytes = new Uint8Array(await parentBlob.arrayBuffer());

  // Build prompts por task (vary = angulos diferentes; iterate/regenerate = iguais)
  const promptsPerTask: string[] = [];
  for (let i = 0; i < concreteCount; i++) {
    promptsPerTask.push(buildTaskPrompt(mode, parent, i, concreteCount, reqBody.instruction));
  }

  const negativePrompt = [
    ...prohibitions.words, ...prohibitions.topics, ...prohibitions.visualRules,
    ...complianceText.baseline_hits.map((h) => h.term),
  ].filter(Boolean).join(', ');

  // Routing model: reels sempre nano (R4.2); auto -> nano (multi-img)
  let resolvedModel: ProviderModel;
  if ((reqBody.model ?? 'auto') === 'auto') {
    resolvedModel = 'nano_banana';
  } else {
    resolvedModel = reqBody.model as ProviderModel;
  }
  if (parent.format === 'reels_4x5') resolvedModel = 'nano_banana';

  // Pipeline paralelo
  const tasks: Promise<Awaited<ReturnType<typeof callProviderWithFallback>>>[] = [];
  for (let i = 0; i < concreteCount; i++) {
    tasks.push(
      callProviderWithFallback(
        {
          model: resolvedModel,
          prompt: promptsPerTask[i],
          format: parent.format,
          parentBytes,
          negativePrompt,
        },
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
      companyId, userId, event: mode === 'vary' ? 'vary' : 'iterate',
      status: 'failed', errorKind: 'timeout_total', count: concreteCount,
      modelUsed: resolvedModel, format: parent.format,
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ error: 'timeout_total' }, 504, cors);
  }
  const settled = raceResult;

  const persisted: CreativeMetadata[] = [];
  let failedCount = 0;
  let blockedByDedupe = 0;

  for (let idx = 0; idx < settled.length; idx++) {
    const r = settled[idx];
    const promptUsed = promptsPerTask[idx] ?? parent.prompt;
    const baseConceptLabel = truncateForConcept(((parent.concept ?? '').trim() || 'Oferta cliente'), 140);
    const rowConcept = mode === 'vary'
      ? `${baseConceptLabel} · variacao-${idx + 1} conceito-distinto`
      : parent.concept;
    if (r.status === 'rejected' || !r.value.ok) {
      failedCount++;
      const errKind = r.status === 'rejected'
        ? 'rejected'
        : (r.value as { error: { kind: string } }).error.kind;
      await insertAgentRun(admin, {
        companyId, userId,
        agentName: resolvedModel === 'gpt_image' ? 'creative-gpt-image' : 'creative-nano-banana',
        conversationId: parent.conversation_id,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        model: resolvedModel === 'gpt_image' ? 'gpt-image-1' : 'gemini-2.5-flash-image',
        errorMessage: errKind,
      });
      continue;
    }
    const ok = r.value;

    let phash: string;
    try { phash = await dhash(ok.bytes); }
    catch { failedCount++; continue; }

    // Dedupe
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400_000).toISOString();
    const { data: hashCandidates } = await admin
      .from('creatives_generated')
      .select('id, phash')
      .eq('company_id', companyId)
      .gte('created_at', cutoff)
      .neq('status', 'discarded');

    let nearDupId: string | null = null;
    let isNearDup = false;
    let blockedDup = false;
    for (const cand of (hashCandidates ?? []) as Array<{ id: string; phash: string }>) {
      if (cand.phash?.length !== 16) continue;
      const dist = hammingDistance(phash, cand.phash);
      if (dist <= HASH_BLOCK_DISTANCE) {
        blockedDup = true; nearDupId = cand.id; break;
      }
      if (dist <= HASH_NEAR_DISTANCE && !isNearDup) {
        isNearDup = true; nearDupId = cand.id;
      }
    }
    if (blockedDup && nearDupId) {
      blockedByDedupe++;
      const cached = await buildResponseFromIds(admin, companyId, [nearDupId]);
      if (cached.creatives[0]) persisted.push(cached.creatives[0]);
      continue;
    }

    const ocr = await runOcrCheck(ok.bytes, ok.mimeType, blocklist, openaiKey)
      .catch(() => ({ detected_text: '', ocr_hits: [], has_warning: false }));

    const newId = crypto.randomUUID();
    const ext = ok.mimeType === 'image/jpeg' ? 'jpg' : ok.mimeType === 'image/webp' ? 'webp' : 'png';
    const storagePath = `${companyId}/${newId}.${ext}`;

    const { error: upErr } = await admin.storage
      .from('generated-creatives')
      .upload(storagePath, ok.bytes, { contentType: ok.mimeType, upsert: false });
    if (upErr) { failedCount++; continue; }

    const { error: insErr } = await admin
      .from('creatives_generated')
      .insert({
        id: newId,
        company_id: companyId,
        conversation_id: parent.conversation_id,
        parent_creative_id: parent.id,
        near_duplicate_of_id: isNearDup ? nearDupId : null,
        prompt: promptUsed,
        concept: rowConcept,
        format: parent.format,
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
      });
    if (insErr) {
      await admin.storage.from('generated-creatives').remove([storagePath]);
      failedCount++;
      continue;
    }

    await admin.from('creative_compliance_check').insert({
      creative_id: newId,
      baseline_hits: complianceText.baseline_hits.map((h) => h.term),
      briefing_hits: complianceText.briefing_hits,
      ocr_hits: ocr.ocr_hits,
      passed: !complianceText.hard_block && !ocr.has_warning,
    });

    await insertAgentRun(admin, {
      companyId, userId,
      agentName: ok.modelUsed === 'gpt-image-1' ? 'creative-gpt-image' : 'creative-nano-banana',
      conversationId: parent.conversation_id,
      status: 'success',
      latencyMs: ok.latencyMs,
      costUsd: ok.costUsd,
      model: ok.modelUsed,
      metadata: {
        fallback_triggered: ok.fallbackTriggered,
        format: parent.format,
        iterate_mode: mode,
        parent_id: parent.id,
      },
    });

    const { data: signed } = await admin.storage
      .from('generated-creatives')
      .createSignedUrl(storagePath, 60 * 60);

    persisted.push({
      id: newId,
      signed_url: signed?.signedUrl ?? '',
      signed_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      format: parent.format,
      model_used: ok.modelUsed,
      cost_usd: ok.costUsd,
      width: ok.width,
      height: ok.height,
      is_near_duplicate: isNearDup,
      near_duplicate_of_id: isNearDup ? nearDupId : null,
      compliance_warning: ocr.has_warning,
    });
  }

  // 5.2 — Iteration warning depth >= 5 (R3.4)
  let iterationWarning: string | undefined;
  if (persisted.length > 0) {
    const { data: prov } = await admin
      .rpc('get_creative_provenance', { p_creative_id: persisted[0].id });
    const depth = typeof prov?.depth === 'number' ? prov.depth : 0;
    if (depth >= ITERATION_WARNING_THRESHOLD) {
      iterationWarning = `Voce ja iterou ${depth} vezes neste criativo. Considere repensar o conceito ou comecar uma nova base — iteracoes excessivas costumam degradar a qualidade.`;
    }
  }

  const totalDuration = Date.now() - startedAt;
  const finalStatus: 'success' | 'failed' | 'partial' =
    persisted.length === 0 ? 'failed'
    : failedCount === 0 ? 'success' : 'partial';

  logCreativeAccess({
    companyId, userId,
    event: mode === 'vary' ? 'vary' : 'iterate',
    modelUsed: resolvedModel === 'gpt_image' ? 'gpt-image-1' : 'gemini-2.5-flash-image',
    format: parent.format,
    count: concreteCount,
    costUsd: persisted.reduce((s, c) => s + c.cost_usd, 0),
    durationMs: totalDuration,
    status: finalStatus,
  });

  if (persisted.length === 0) {
    return jsonResponse(
      { error: 'provider_unavailable', failed_count: failedCount, blocked_by_dedupe: blockedByDedupe },
      503, cors,
    );
  }

  const response: IterateResponse = {
    creatives: persisted,
    failed_count: failedCount,
    blocked_by_dedupe: blockedByDedupe,
    warnings,
    ...(iterationWarning ? { iteration_warning: iterationWarning } : {}),
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
): Promise<{ creatives: CreativeMetadata[] }> {
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
  return { creatives };
}
