// Provider abstraction para geracao de imagem.
// Spec: ai-creative-generation (tasks 3.2, 3.3 — R2.1, R2.2, R2.3, R2.4, R2.6, R4.2, R11.1, R11.3)
//
// Suporta:
//   - Gemini 2.5 Flash Image (Nano Banana 2): generativelanguage.googleapis.com
//   - OpenAI gpt-image-1: api.openai.com/v1/images/generations (e /edits para img2img)
//
// Fallback automatico Nano -> GPT em 5xx/timeout.
// Retry exponencial 1s/3s/7s ate 3 tentativas por provider.
// Timeout 30s/chamada.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const OPENAI_IMG_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDIT_URL = 'https://api.openai.com/v1/images/edits';

// 2026-05-04: per-call timeout subiu pra 60s. Story 9x16 em Nano costuma levar
// 30-60s em horario de pico. Retries reduzidas (so 1) — nao adianta esticar em
// timeout normal de provider. TOTAL_TIMEOUT_MS (85s) ainda corta antes do edge.
const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2_000];

// Pricing por imagem (USD) — abril/2026, conferir em research.md
const NANO_BANANA_COST_USD = 0.039;
const GPT_IMAGE_HIGH_1024 = 0.167;
const GPT_IMAGE_HIGH_1536 = 0.25;

export type AspectFormat = 'feed_1x1' | 'story_9x16' | 'reels_4x5';
export type ProviderModel = 'nano_banana' | 'gpt_image';
export type ResolvedModel = 'gemini-2.5-flash-image' | 'gpt-image-1';

export interface ProviderInput {
  model: ProviderModel;
  prompt: string;
  format: AspectFormat;
  /** Opcional: bytes do parent para img2img (iteracao consistente). */
  parentBytes?: Uint8Array;
  /** Opcional: bytes do logo do briefing para incluir como referencia visual. */
  logoBytes?: Uint8Array;
  /** Negative prompt — proibicoes do briefing + blocklist baseline. */
  negativePrompt?: string;
}

export interface ProviderOk {
  ok: true;
  bytes: Uint8Array;
  mimeType: string;
  modelUsed: ResolvedModel;
  costUsd: number;
  latencyMs: number;
  width: number;
  height: number;
  fallbackTriggered: boolean;
}

export interface ProviderFail {
  ok: false;
  error:
    | { kind: 'provider_unavailable'; lastError: string }
    | { kind: 'invalid_response'; detail: string }
    | { kind: 'timeout' };
}

export type ProviderResult = ProviderOk | ProviderFail;

// ============================================================
// Helpers
// ============================================================

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function aspectRatioGemini(format: AspectFormat): string {
  switch (format) {
    case 'feed_1x1':  return '1:1';
    case 'story_9x16': return '9:16';
    case 'reels_4x5': return '4:5';
  }
}

/**
 * GPT-image-1 nao tem aspect 4:5 nativo. Mapeia:
 *   feed_1x1   -> 1024x1024
 *   story_9x16 -> 1024x1536
 *   reels_4x5  -> ESCAPE: nao deveria chegar aqui (force Nano Banana em routing)
 */
function gptImageSize(format: AspectFormat): { size: string; width: number; height: number; cost: number } {
  switch (format) {
    case 'feed_1x1':   return { size: '1024x1024', width: 1024, height: 1024, cost: GPT_IMAGE_HIGH_1024 };
    case 'story_9x16': return { size: '1024x1536', width: 1024, height: 1536, cost: GPT_IMAGE_HIGH_1536 };
    case 'reels_4x5':  return { size: '1024x1024', width: 1024, height: 1024, cost: GPT_IMAGE_HIGH_1024 };
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Nano Banana 2 (Gemini)
// ============================================================

async function callGemini(input: ProviderInput, apiKey: string): Promise<ProviderResult> {
  const startedAt = Date.now();

  const parts: Array<Record<string, unknown>> = [];
  // Texto principal
  let promptText = input.prompt;
  if (input.negativePrompt) {
    promptText += `\n\nEvite obrigatoriamente: ${input.negativePrompt}`;
  }
  parts.push({ text: promptText });

  // Logo como referencia visual (img2img light)
  if (input.logoBytes) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: bytesToBase64(input.logoBytes),
      },
    });
  }

  // Parent para iteracao consistente
  if (input.parentBytes) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: bytesToBase64(input.parentBytes),
      },
    });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: aspectRatioGemini(input.format) },
    },
  };

  let resp: Response;
  try {
    resp = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: { kind: 'timeout' } };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      ok: false,
      error: { kind: 'provider_unavailable', lastError: `gemini ${resp.status}: ${text.slice(0, 200)}` },
    };
  }

  const json = await resp.json();
  const inlineData = json.candidates?.[0]?.content?.parts?.find((p: { inline_data?: unknown }) => p.inline_data);
  const data = inlineData?.inline_data?.data as string | undefined;
  const mimeType = (inlineData?.inline_data?.mime_type as string | undefined) ?? 'image/png';

  if (!data) {
    return { ok: false, error: { kind: 'invalid_response', detail: 'gemini retornou sem inline_data' } };
  }

  const bytes = base64ToBytes(data);
  // Nano Banana sempre ~1024 no maior lado. Aspect ratio ja foi enviado nativamente.
  const dims = aspectDimensions(input.format);

  return {
    ok: true,
    bytes,
    mimeType,
    modelUsed: 'gemini-2.5-flash-image',
    costUsd: NANO_BANANA_COST_USD,
    latencyMs: Date.now() - startedAt,
    width: dims.width,
    height: dims.height,
    fallbackTriggered: false,
  };
}

function aspectDimensions(format: AspectFormat): { width: number; height: number } {
  switch (format) {
    case 'feed_1x1':   return { width: 1024, height: 1024 };
    case 'story_9x16': return { width: 1024, height: 1820 };
    case 'reels_4x5':  return { width: 1024, height: 1280 };
  }
}

// ============================================================
// GPT-image-1 (OpenAI)
// ============================================================

async function callGptImage(input: ProviderInput, apiKey: string): Promise<ProviderResult> {
  const startedAt = Date.now();
  const sizing = gptImageSize(input.format);

  let resp: Response;
  try {
    if (input.parentBytes || input.logoBytes) {
      // /v1/images/edits — multipart com parent + opcional logo
      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      fd.append('prompt', input.negativePrompt
        ? `${input.prompt}\n\nEvite: ${input.negativePrompt}`
        : input.prompt);
      fd.append('size', sizing.size);
      fd.append('quality', 'medium');
      fd.append('input_fidelity', 'high');
      if (input.parentBytes) {
        fd.append('image', new Blob([input.parentBytes], { type: 'image/png' }), 'parent.png');
      } else if (input.logoBytes) {
        fd.append('image', new Blob([input.logoBytes], { type: 'image/png' }), 'logo.png');
      }
      resp = await fetchWithTimeout(OPENAI_EDIT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });
    } else {
      // /v1/images/generations — JSON puro
      resp = await fetchWithTimeout(OPENAI_IMG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: input.negativePrompt
            ? `${input.prompt}\n\nEvite: ${input.negativePrompt}`
            : input.prompt,
          n: 1,
          size: sizing.size,
          quality: 'medium',
          output_format: 'png',
        }),
      });
    }
  } catch (e) {
    return { ok: false, error: { kind: 'timeout' } };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      ok: false,
      error: { kind: 'provider_unavailable', lastError: `gpt-image ${resp.status}: ${text.slice(0, 200)}` },
    };
  }

  const json = await resp.json();
  const b64 = json.data?.[0]?.b64_json as string | undefined;
  if (!b64) {
    return { ok: false, error: { kind: 'invalid_response', detail: 'gpt-image retornou sem b64_json' } };
  }

  return {
    ok: true,
    bytes: base64ToBytes(b64),
    mimeType: 'image/png',
    modelUsed: 'gpt-image-1',
    costUsd: sizing.cost,
    latencyMs: Date.now() - startedAt,
    width: sizing.width,
    height: sizing.height,
    fallbackTriggered: false,
  };
}

// ============================================================
// Public API: callProvider + callProviderWithFallback
// ============================================================

export async function callProvider(
  input: ProviderInput,
  keys: { openai: string; gemini: string },
): Promise<ProviderResult> {
  // Routing R4.2: reels (4:5) sempre Nano Banana mesmo com model='gpt_image'
  // (GPT-image-1 nao tem 4:5 nativo)
  if (input.format === 'reels_4x5' && input.model === 'gpt_image') {
    input = { ...input, model: 'nano_banana' };
  }

  if (input.model === 'nano_banana') {
    return callGemini(input, keys.gemini);
  }
  return callGptImage(input, keys.openai);
}

/**
 * Retry com backoff exponencial + fallback Nano -> GPT.
 *
 * Pipeline:
 *   1. Tenta provider primario (model do input) com 3 tentativas
 *   2. Se falhar, tenta provider alternativo com 3 tentativas (flag fallback=true)
 *   3. Se ambos falharem -> ProviderFail (caller NAO cobra quota)
 */
export async function callProviderWithFallback(
  input: ProviderInput,
  keys: { openai: string; gemini: string },
): Promise<ProviderResult> {
  // Tentativa 1: provider escolhido
  const primary = await tryWithRetries(input, keys);
  if (primary.ok) return primary;

  // Fallback so faz sentido se o erro for transient (provider down/timeout)
  // E se houver alternativa (reels_4x5 fica preso em nano_banana — nao tem GPT 4:5)
  if (input.format === 'reels_4x5') {
    return primary;
  }

  const alternativeModel: ProviderModel = input.model === 'nano_banana' ? 'gpt_image' : 'nano_banana';
  const fallbackInput: ProviderInput = { ...input, model: alternativeModel };
  const fb = await tryWithRetries(fallbackInput, keys);
  if (fb.ok) {
    return { ...fb, fallbackTriggered: true };
  }
  return fb;
}

async function tryWithRetries(input: ProviderInput, keys: { openai: string; gemini: string }): Promise<ProviderResult> {
  let lastError: ProviderFail | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    const result = await callProvider(input, keys);
    if (result.ok) return result;
    lastError = result;
    // Erros nao-transient (invalid_response) nao se beneficiam de retry
    if (result.error.kind === 'invalid_response') break;
  }
  return lastError ?? { ok: false, error: { kind: 'provider_unavailable', lastError: 'unknown' } };
}
