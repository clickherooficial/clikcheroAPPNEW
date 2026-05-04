// Handlers das tools de criativo no ai-chat.
// Spec: ai-creative-generation (task 10.2)
//
// Cada handler invoca a Edge Function correspondente passando o JWT do user
// (Edge Functions exigem requireTenant). Retorna markdown formatado contendo
// `<creative-gallery ids="..."/>` que o ChatView reconhece e renderiza inline.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

interface InvokeOpts {
  endpoint: 'creative-generate' | 'creative-iterate';
  body: Record<string, unknown>;
  authHeader: string;
}

async function invokeEdgeFn(opts: InvokeOpts): Promise<unknown> {
  const url = `${SUPABASE_URL}/functions/v1/${opts.endpoint}`;
  const t0 = Date.now();
  console.log(`[creative-tool] -> POST ${opts.endpoint} body keys=${Object.keys(opts.body).join(',')}`);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: opts.authHeader,
      },
      body: JSON.stringify(opts.body),
    });
  } catch (fetchErr) {
    console.error(`[creative-tool] fetch ${opts.endpoint} threw after ${Date.now() - t0}ms:`, (fetchErr as Error)?.message);
    return { __error: true, status: 0, body: { error: 'network_error', message: (fetchErr as Error)?.message ?? 'fetch failed' } };
  }
  const text = await resp.text();
  console.log(`[creative-tool] <- ${opts.endpoint} status=${resp.status} in ${Date.now() - t0}ms (body ${text.length}b)`);
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  if (!resp.ok) {
    return { __error: true, status: resp.status, body: json ?? text };
  }
  return json;
}

interface CreativeMeta {
  id: string;
  format: string;
  model_used: string;
  cost_usd: number;
  is_near_duplicate?: boolean;
  compliance_warning?: boolean;
}

interface SuccessResp {
  creatives: CreativeMeta[];
  failed_count: number;
  blocked_by_dedupe: number;
  warnings: string[];
  iteration_warning?: string;
}

interface ErrorResp {
  __error: true;
  status: number;
  body: unknown;
}

function isErrorResp(r: unknown): r is ErrorResp {
  return typeof r === 'object' && r !== null && '__error' in r;
}

function formatErrorForChat(err: ErrorResp): string {
  const body = (err.body ?? {}) as { error?: string; message?: string; missingFields?: string[]; dimensions?: string[]; hits?: unknown };
  switch (body.error) {
    case 'quota_exceeded':
      return `Quota de geracao atingida (${(body.dimensions ?? []).join(', ')}). Faca upgrade do plano ou aguarde o ciclo virar.`;
    case 'briefing_incomplete':
      return `Briefing incompleto. Faltam: ${(body.missingFields ?? []).join(', ')}. Complete o briefing antes de gerar criativos.`;
    case 'plan_upgrade_required':
      return body.message ?? 'Plano atual nao permite GPT-image. Faca upgrade ou use Nano Banana.';
    case 'forbidden_by_briefing':
      return `Bloqueado: o conceito viola proibicoes do briefing (${JSON.stringify(body.hits ?? [])}). Reescreva o pedido evitando esses termos.`;
    case 'forbidden_by_blocklist':
      return `Atencao: o conceito contem termos sensiveis pela Meta (${JSON.stringify(body.hits ?? [])}). Reformule o pedido ou peca explicitamente para sobrepor o aviso.`;
    case 'provider_unavailable':
      return 'Provedor de imagem indisponivel no momento (OpenAI/Gemini retornou erro). Diga ao usuario LITERALMENTE: "O provedor de imagem (OpenAI/Gemini) esta indisponivel agora. Tente novamente em 1-2 minutos."';
    case 'timeout_total':
      return 'Geracao excedeu o timeout (provider lento). Diga ao usuario LITERALMENTE: "O gerador de imagem ta lento agora — passou do limite e foi cancelado. Quer que eu tente de novo? Se preferir, posso usar um formato mais leve (feed quadrado 1:1)." — NAO diga apenas "houve um problema".';
    case 'parent_not_found':
      return 'Criativo pai nao encontrado ou nao acessivel.';
    case 'source_not_found':
      return 'Criativo fonte para adapt nao encontrado.';
    default: {
      const detail = body.message ?? body.error ?? JSON.stringify(err.body).slice(0, 300);
      return `Erro na geracao (HTTP ${err.status}): ${detail}. IMPORTANTE: repasse essa mensagem LITERAL ao usuario — nao reescreva genericamente — pois ela contem a causa real do problema.`;
    }
  }
}

function formatSuccess(resp: SuccessResp, action: 'gerada' | 'iterada' | 'variada' | 'adaptada'): string {
  if (resp.creatives.length === 0) {
    return `Nenhuma imagem foi ${action} (failed=${resp.failed_count}, dedupe=${resp.blocked_by_dedupe}).`;
  }
  const ids = resp.creatives.map((c) => c.id).join(',');
  const totalCost = resp.creatives.reduce((s, c) => s + c.cost_usd, 0);

  const lines: string[] = [];
  lines.push(`${resp.creatives.length} imagem(ns) ${action} com sucesso (custo: US$ ${totalCost.toFixed(4)}).`);

  if (resp.failed_count > 0) lines.push(`Falhas: ${resp.failed_count}.`);
  if (resp.blocked_by_dedupe > 0) lines.push(`Bloqueadas por similaridade com criativos anteriores: ${resp.blocked_by_dedupe}.`);
  for (const w of resp.warnings ?? []) lines.push(`Aviso: ${w}`);
  if (resp.iteration_warning) lines.push(resp.iteration_warning);

  // Tag custom que o ChatView vai parsear pra renderizar a galeria inline
  lines.push(`<creative-gallery ids="${ids}"/>`);

  return lines.join('\n\n');
}

// ============================================================
// Public handlers — assinaturas casam com o switch em executeTool
// ============================================================

export async function invokeCreativeGenerate(
  authHeader: string,
  args: {
    concept: string;
    format: 'feed_1x1' | 'story_9x16' | 'reels_4x5';
    count?: 1 | 2 | 3 | 4;
    style_hint?: string;
    use_logo?: boolean;
    model?: 'auto' | 'nano_banana' | 'gpt_image';
  },
  conversationId: string | null,
): Promise<string> {
  const body: Record<string, unknown> = {
    concept: args.concept,
    format: args.format,
    count: args.count ?? 1,
    mode: 'create',
  };
  if (args.style_hint) body.style_hint = args.style_hint;
  if (typeof args.use_logo === 'boolean') body.use_logo = args.use_logo;
  if (args.model) body.model = args.model;
  if (conversationId) body.conversation_id = conversationId;

  const result = await invokeEdgeFn({ endpoint: 'creative-generate', body, authHeader });
  if (isErrorResp(result)) return formatErrorForChat(result);
  return formatSuccess(result as SuccessResp, 'gerada');
}

export async function invokeCreativeIterate(
  authHeader: string,
  args: {
    parent_creative_id: string;
    instruction?: string;
    mode?: 'iterate' | 'regenerate' | 'vary';
    count?: 1 | 2 | 3;
  },
  label: 'iterate' | 'vary',
): Promise<string> {
  const body: Record<string, unknown> = {
    parent_creative_id: args.parent_creative_id,
    mode: args.mode ?? (label === 'vary' ? 'vary' : 'iterate'),
  };
  if (args.instruction) body.instruction = args.instruction;
  if (args.count) body.count = args.count;

  const result = await invokeEdgeFn({ endpoint: 'creative-iterate', body, authHeader });
  if (isErrorResp(result)) return formatErrorForChat(result);
  return formatSuccess(result as SuccessResp, label === 'vary' ? 'variada' : 'iterada');
}

export async function invokeCreativeAdapt(
  authHeader: string,
  args: {
    source_creative_id: string;
    format: 'feed_1x1' | 'story_9x16' | 'reels_4x5';
    count?: 1 | 2;
  },
  conversationId: string | null,
): Promise<string> {
  const body: Record<string, unknown> = {
    concept: 'Adaptacao multi-aspecto',
    format: args.format,
    count: args.count ?? 1,
    mode: 'adapt',
    source_creative_id: args.source_creative_id,
  };
  if (conversationId) body.conversation_id = conversationId;

  const result = await invokeEdgeFn({ endpoint: 'creative-generate', body, authHeader });
  if (isErrorResp(result)) return formatErrorForChat(result);
  return formatSuccess(result as SuccessResp, 'adaptada');
}
