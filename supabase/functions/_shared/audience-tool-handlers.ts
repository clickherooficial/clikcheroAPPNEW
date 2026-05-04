// audience-tool-handlers — audience-management (Sprint 3/8)
// 4 handlers que disparam Edge Fns de audiencia a partir do dispatcher do chat.
// deno-lint-ignore-file no-explicit-any

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

async function invoke(fnName: string, authHeader: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': ANON,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function summarize(label: string, resp: { status: number; json: any }): string {
  if (resp.json?.requires_confirmation) {
    return `${label} requer confirmacao explicita do usuario (passar confirm=true). Acao NAO executada.`;
  }
  if (resp.json?.in_active_use) {
    const adsets = (resp.json.adsets ?? []).map((a: any) => a.adset_name).join(', ');
    return `${label} bloqueado: audiencia em uso ativo nos adsets [${adsets}]. Pause ou desanexe primeiro.`;
  }
  if (resp.json?.ok && resp.json?.sandbox && resp.json?.simulated) {
    return `[SANDBOX] ${label} simulado (nao executado real). Ledger: ${resp.json.ledger_id}.`;
  }
  if (resp.json?.blocked) {
    return `${label} bloqueado por safety: ${resp.json.reason}. Ledger: ${resp.json.ledger_id ?? '—'}.`;
  }
  if (resp.json?.ok) {
    if (resp.json.audience_id) {
      return `${label} OK. audience_id=${resp.json.audience_id} external=${resp.json.external_id}. Ledger: ${resp.json.ledger_id}.`;
    }
    return `${label} OK. Ledger: ${resp.json.ledger_id}.`;
  }
  return `${label} falhou: ${resp.json?.error ?? `HTTP ${resp.status}`}.`;
}

export async function executeCreateCustomerListAudience(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-create', authHeader, body);
  return summarize('create_customer_list_audience', resp);
}

export async function executeCreateLookalike(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-lookalike', authHeader, body);
  return summarize('create_lookalike_audience', resp);
}

export async function executeUpdateAudience(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-update', authHeader, body);
  return summarize('update_audience', resp);
}

export async function executeDeleteAudience(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-delete', authHeader, body);
  return summarize('delete_audience', resp);
}

// ===== pixel-engagement-audiences (Sprint 4/8) =====

export async function executeCreatePixelAudience(authHeader: string, args: any): Promise<string> {
  const body = { kind: 'pixel', ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-create-rule', authHeader, body);
  return summarize('create_pixel_audience', resp);
}

export async function executeCreateEngagementAudience(authHeader: string, args: any): Promise<string> {
  const body = { kind: 'engagement', ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-audience-create-rule', authHeader, body);
  return summarize('create_engagement_audience', resp);
}
