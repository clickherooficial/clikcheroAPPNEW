// Helper generico para invocar sub-agentes especialistas via HTTP.
// Spec: multi-agent-specialists (C0.1)
//
// Substitui delegateToSpecialist hardcoded para meta-ads-specialist.
// Cada specialist roda como Edge Function isolada que retorna:
//   { ok: true, answer, tokens, cost_usd, metadata? }
// metadata pode conter compliance_action, proposed_rule, etc — campos
// estruturados que o orchestrator embute em chat_messages.metadata.

export type SpecialistEndpoint =
  | 'meta-ads-specialist'
  | 'creative-specialist'
  | 'compliance-officer'
  | 'action-manager';

export interface SpecialistResponse {
  ok: boolean;
  answer: string;
  tokens?: number;
  cost_usd?: number;
  /** Campos estruturados que o orchestrator deve propagar pra metadata da assistant message */
  metadata?: {
    compliance_action?: unknown;
    proposed_rule?: unknown;
    [key: string]: unknown;
  };
  error?: string;
}

export interface InvokeSpecialistArgs {
  endpoint: SpecialistEndpoint;
  question: string;
  context?: string;
  companyId: string;
  conversationId: string | null;
  /** parent_run_id do orchestrator pra correlacionar custo/latencia */
  parentRunId?: string | null;
  /** authHeader do user — alguns specialists precisam pra invocar Edge Fns que exigem JWT */
  authHeader?: string;
}

/**
 * Invoca um specialist via service-role JWT (specialist roda em isolation,
 * nao precisa do JWT do user — tem company_id passado direto).
 *
 * Para specialists que precisam invocar OUTRAS Edge Fns que exigem JWT (ex:
 * creative-specialist chamando creative-generate), a authHeader do user e
 * propagada no body.
 */
export async function invokeSpecialist(
  args: InvokeSpecialistArgs,
): Promise<{ summary: string; metadata?: SpecialistResponse['metadata'] }> {
  if (!args.question || args.question.length < 5) {
    return { summary: 'Pergunta muito curta para delegar. Forneca uma pergunta especifica.' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return { summary: 'Falha na configuracao de delegacao (env).' };
  }

  const t0 = Date.now();
  console.log(`[specialist] -> POST ${args.endpoint} q="${args.question.slice(0, 80)}"`);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${args.endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: args.question,
        context: args.context ?? null,
        company_id: args.companyId,
        conversation_id: args.conversationId,
        parent_run_id: args.parentRunId ?? null,
        user_auth_header: args.authHeader ?? null,
      }),
    });

    const rawText = await res.text();
    console.log(`[specialist] <- ${args.endpoint} status=${res.status} in ${Date.now() - t0}ms (body ${rawText.length}b)`);
    let body: SpecialistResponse;
    try {
      body = JSON.parse(rawText) as SpecialistResponse;
    } catch {
      console.error(`[specialist] ${args.endpoint} non-JSON body (first 500): ${rawText.slice(0, 500)}`);
      return { summary: `Specialist ${args.endpoint} retornou resposta invalida (HTTP ${res.status}).` };
    }

    if (!res.ok || !body.ok) {
      console.error(`[specialist] ${args.endpoint} failed: status=${res.status} ok=${body.ok} error=${body.error ?? 'unknown'} fullBody=${rawText.slice(0, 300)}`);
      return {
        summary: `Specialist ${args.endpoint} falhou: ${body.error ?? 'unknown'}. Continue com tools diretas se possivel.`,
      };
    }

    const cost = Number(body.cost_usd ?? 0).toFixed(4);
    const tag = friendlyName(args.endpoint);
    return {
      summary: `[Resposta do ${tag} — tokens: ${body.tokens ?? 0}, custo: US$ ${cost}]\n\n${body.answer}`,
      metadata: body.metadata,
    };
  } catch (err) {
    return {
      summary: `Falha ao delegar para ${args.endpoint}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function friendlyName(endpoint: SpecialistEndpoint): string {
  switch (endpoint) {
    case 'meta-ads-specialist':
      return 'Meta Ads Specialist';
    case 'creative-specialist':
      return 'Creative Specialist';
    case 'compliance-officer':
      return 'Compliance Officer';
    case 'action-manager':
      return 'Action Manager';
  }
}
