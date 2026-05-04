// agent-execution-loop (Sprint 5/8) — handler do tool execute_plan.
// deno-lint-ignore-file no-explicit-any

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export async function executeExecutePlan(authHeader: string, args: any): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-plan-execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': ANON,
    },
    body: JSON.stringify({ plan_id: args.plan_id }),
  });
  const json = await res.json().catch(() => ({}));

  if (json.error === 'plan_not_in_approved_state') {
    return 'Plano nao esta no estado approved. Usuario precisa aprovar via UI primeiro (cards de aprovacao).';
  }
  if (json.status === 'executed') {
    return `Plano "${json.summary}" executado com sucesso. ${json.executed}/${json.total} passos. Ledger entries: ${json.ledger_ids?.length ?? 0}.`;
  }
  if (json.status === 'partial') {
    return `Plano "${json.summary}" PARCIAL: ${json.executed}/${json.total} passos OK, falhou no step ${json.failed_at_step}. ${json.blocked_by_safety ? 'Bloqueado por safety rails.' : 'Erro: ' + json.last_error}.`;
  }
  if (json.status === 'failed') {
    return `Plano falhou no primeiro passo. Erro: ${json.last_error}.`;
  }
  return `Resposta inesperada: ${JSON.stringify(json).slice(0, 200)}`;
}
