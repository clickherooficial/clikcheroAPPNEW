// Compliance Runner — modulo compartilhado de scoring de compliance.
// Spec: chat-publish-flow (task 2.1)
//
// Extraido de campaign-publish/index.ts para permitir reuso pelo handler
// `propose_campaign` do orchestrator (preview no card inline) sem duplicar
// logica. Mantem comportamento bit-a-bit identico ao anterior — campaign-publish
// passa a importar daqui (task 2.2).
//
// Duas APIs:
//
//   runComplianceCheckRaw(supabase, companyId, input) -> { score, violations, blocked }
//     Saida no formato legado de campaign-publish. Use no gate definitivo.
//
//   runComplianceCheck(supabase, input) -> { severity, score, hits, blocking, duration_ms }
//     Saida no formato de UI (badge verde/amarelo/vermelho). Use no preview.
//     Internamente chama runComplianceCheckRaw e adapta.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20241022';

// ============================================================
// Tipos publicos
// ============================================================

export interface ComplianceCopyInput {
  headline: string;
  body: string;
  description?: string;
}

export interface ComplianceRawInput {
  copy: ComplianceCopyInput;
  image_url?: string;
}

export interface ComplianceViolation {
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface ComplianceRawResult {
  score: number; // 0-100
  violations: ComplianceViolation[];
  blocked: boolean;
}

export type ComplianceSeverity = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export interface ComplianceHit {
  kind: 'word' | 'visual' | 'topic';
  text: string;
  severity: ComplianceSeverity;
}

export interface ComplianceCheckInput extends ComplianceRawInput {
  company_id: string;
  // 'preview' = card inline (timeout menor, fail-open com severity='unknown')
  // 'gate'    = bloqueio definitivo do campaign-publish (timeout maior)
  context?: 'preview' | 'gate';
}

export interface ComplianceCheckResult {
  severity: ComplianceSeverity;
  score: number;
  hits: ComplianceHit[];
  blocking: boolean;
  duration_ms: number;
}

// ============================================================
// Helpers internos (movidos de campaign-publish)
// ============================================================

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);
    const mediaType = contentType.includes('png') ? 'image/png'
      : contentType.includes('webp') ? 'image/webp'
      : contentType.includes('gif') ? 'image/gif' : 'image/jpeg';
    return { base64, mediaType };
  } catch {
    return null;
  }
}

async function callClaudeForCompliance(
  apiKey: string,
  systemPrompt: string,
  content: Array<{ type: string; [key: string]: unknown }>,
): Promise<{ score: number; violations: ComplianceViolation[] } | null> {
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1].trim() : raw.trim();
    const parsed = JSON.parse(jsonStr);
    return {
      score: Math.max(0, Math.min(100, parsed.score ?? 100)),
      violations: Array.isArray(parsed.violations) ? parsed.violations as ComplianceViolation[] : [],
    };
  } catch {
    return null;
  }
}

// ============================================================
// API publica — RAW (saida legado, usada por campaign-publish)
// ============================================================

/**
 * Mantem comportamento bit-a-bit identico ao `checkCompliance` original
 * de campaign-publish. Use no gate definitivo (campaign-publish/publish_campaign).
 */
export async function runComplianceCheckRaw(
  supabase: SupabaseClient,
  companyId: string,
  input: ComplianceRawInput,
): Promise<ComplianceRawResult> {
  // Busca ANTHROPIC_API_KEY
  const { data: key } = await supabase.rpc('get_vault_secret', { secret_name: 'ANTHROPIC_API_KEY' });
  const apiKey = (key as string | null) ?? Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  // Busca config + blacklist
  const { data: company } = await supabase
    .from('companies')
    .select('takedown_threshold, brand_colors, brand_logo_url')
    .eq('id', companyId)
    .single();

  const { data: rules } = await supabase
    .from('compliance_rules')
    .select('value, rule_type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('rule_type', ['blacklist_term', 'required_term']);

  const blacklist = (rules ?? []).filter((r) => r.rule_type === 'blacklist_term').map((r) => r.value);
  const required = (rules ?? []).filter((r) => r.rule_type === 'required_term').map((r) => r.value);
  const threshold = (company?.takedown_threshold as number | null) ?? 50;

  if (!apiKey) {
    // Sem API key: nao bloqueia, mas retorna score neutro (compatibilidade)
    return { score: 100, violations: [], blocked: false };
  }

  const { copy, image_url } = input;

  // --- Copy analysis ---
  const copyText = `Headline: ${copy.headline}\nBody: ${copy.body}${copy.description ? `\nDescription: ${copy.description}` : ''}`;
  const copySystem = `Voce e um especialista em compliance de anuncios Meta Ads.
Analise o copy do anuncio e retorne APENAS um JSON valido (sem markdown).
Regras: critical=-40pts, warning=-20pts, info=-5pts. Score 0-100.`;
  const copyUser = `COPY:
${copyText}

TERMOS PROIBIDOS: ${blacklist.length > 0 ? blacklist.join(', ') : '(nenhum)'}
TERMOS OBRIGATORIOS: ${required.length > 0 ? required.join(', ') : '(nenhum)'}

Retorne: {"score": <0-100>, "violations": [{"severity": "info|warning|critical", "description": "<texto>"}]}`;

  const copyResult = await callClaudeForCompliance(apiKey, copySystem, [{ type: 'text', text: copyUser }]);
  const copyScore = copyResult?.score ?? 100;
  const copyViolations = copyResult?.violations ?? [];

  // --- Image analysis (se houver imagem e brand config) ---
  let imageScore: number | null = null;
  let imageViolations: ComplianceViolation[] = [];

  if (image_url) {
    const img = await fetchImageAsBase64(image_url);
    if (img) {
      const brandColors = (company?.brand_colors as string[] | null) ?? [];
      const brandLogoUrl = (company?.brand_logo_url as string | null) ?? null;

      const imgSystem = `Voce e especialista em compliance visual de anuncios Meta Ads.
Retorne APENAS um JSON valido (sem markdown). Regras: critical=-40, warning=-20, info=-5. Score 0-100.`;

      const colorSection = brandColors.length > 0
        ? `\nCORES DA MARCA (hex): ${brandColors.join(', ')}\nVerifique aderencia.`
        : '';

      const imgUser = `TERMOS PROIBIDOS: ${blacklist.length > 0 ? blacklist.join(', ') : '(nenhum)'}${colorSection}

Tarefas: extraia texto (OCR), verifique termos proibidos no texto extraido, detecte claims visuais problematicos (antes/depois, numeros sem fonte), elementos enganosos.

Retorne: {"score": <0-100>, "violations": [{"severity": "info|warning|critical", "description": "<texto>"}]}`;

      const imgContent: Array<{ type: string; [key: string]: unknown }> = [];
      if (brandLogoUrl) {
        const logoImg = await fetchImageAsBase64(brandLogoUrl);
        if (logoImg) imgContent.push({ type: 'image', source: { type: 'base64', media_type: logoImg.mediaType, data: logoImg.base64 } });
      }
      imgContent.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
      imgContent.push({ type: 'text', text: imgUser });

      const result = await callClaudeForCompliance(apiKey, imgSystem, imgContent);
      if (result) {
        imageScore = result.score;
        imageViolations = result.violations;
      }
    }
  }

  // --- Final score: ponderado 60% copy + 40% visual (ou so copy) ---
  const finalScore = imageScore !== null
    ? Math.round(copyScore * 0.6 + imageScore * 0.4)
    : copyScore;
  const allViolations = [...copyViolations, ...imageViolations];
  const blocked = finalScore < threshold;

  return { score: finalScore, violations: allViolations, blocked };
}

// ============================================================
// API publica — UI shape (usada por propose_campaign)
// ============================================================

const PREVIEW_TIMEOUT_MS = 10_000;
const GATE_TIMEOUT_MS = 30_000;

function severityFromScore(score: number, threshold: number): ComplianceSeverity {
  // Mapeamento conservador: severity reflete distancia do threshold.
  // - >=85: none
  // - threshold..85: low
  // - threshold-15..threshold: medium
  // - <threshold-15: high
  if (score >= 85) return 'none';
  if (score >= threshold) return 'low';
  if (score >= threshold - 15) return 'medium';
  return 'high';
}

function violationsToHits(violations: ComplianceViolation[]): ComplianceHit[] {
  // Heuristica de classificacao por substring no texto.
  // 'visual' tem prioridade quando descricao menciona OCR/imagem; default 'word'.
  return violations.map((v): ComplianceHit => {
    const text = v.description;
    const sev: ComplianceSeverity = v.severity === 'critical' ? 'high'
      : v.severity === 'warning' ? 'medium'
      : 'low';
    const lower = text.toLowerCase();
    const kind: ComplianceHit['kind'] = (lower.includes('imagem') || lower.includes('visual') || lower.includes('ocr') || lower.includes('cor'))
      ? 'visual'
      : (lower.includes('tema') || lower.includes('topico') || lower.includes('categoria')) ? 'topic'
      : 'word';
    return { kind, text, severity: sev };
  });
}

/**
 * API de alto nivel — adaptada pro consumo do card inline (UI).
 * Pode usar timeout menor em modo `preview` e fail-open com severity='unknown'.
 *
 * Em context='gate', mantem o comportamento conservador.
 */
export async function runComplianceCheck(
  supabase: SupabaseClient,
  input: ComplianceCheckInput,
): Promise<ComplianceCheckResult> {
  const start = Date.now();
  const context = input.context ?? 'preview';
  const timeoutMs = context === 'preview' ? PREVIEW_TIMEOUT_MS : GATE_TIMEOUT_MS;

  // Busca threshold do tenant pra calcular severity
  const { data: company } = await supabase
    .from('companies')
    .select('takedown_threshold')
    .eq('id', input.company_id)
    .single();
  const threshold = (company?.takedown_threshold as number | null) ?? 50;

  // Race contra timeout
  const raceResult = await Promise.race([
    runComplianceCheckRaw(supabase, input.company_id, { copy: input.copy, image_url: input.image_url }),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
  ]);

  const duration_ms = Date.now() - start;

  if (raceResult === 'timeout') {
    // Fail-open: deixa o gate definitivo decidir; UI mostra badge cinza
    return {
      severity: 'unknown',
      score: 0,
      hits: [],
      blocking: false,
      duration_ms,
    };
  }

  const severity = severityFromScore(raceResult.score, threshold);
  // 'blocking' so e true em context='gate' E severity='high'
  const blocking = context === 'gate' && (raceResult.blocked || severity === 'high');

  return {
    severity,
    score: raceResult.score,
    hits: violationsToHits(raceResult.violations),
    blocking,
    duration_ms,
  };
}
