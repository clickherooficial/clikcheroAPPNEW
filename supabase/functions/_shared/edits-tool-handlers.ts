// edits-tool-handlers — meta-edits-suite (Sprint 2/8)
// Handlers que disparam as 5 Edge Functions de meta-edits a partir do dispatcher do chat.
// Cada handler faz fetch HTTP pra Edge Fn correspondente repassando o JWT do usuario.
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

function summarize(label: string, args: any, resp: { status: number; json: any }): string {
  if (resp.json?.ok && resp.json?.sandbox && resp.json?.simulated) {
    return `[SANDBOX] ${label} simulado (nao executado real). Ledger: ${resp.json.ledger_id}. Para executar de fato, desligue o modo sandbox em Seguranca.`;
  }
  if (resp.json?.blocked) {
    return `${label} bloqueado por safety: ${resp.json.reason}. Ledger: ${resp.json.ledger_id ?? '—'}. Cheque a view de Seguranca pra ver os limites.`;
  }
  if (resp.json?.ok) {
    const fields = Array.isArray(resp.json.fields_updated) && resp.json.fields_updated.length > 0
      ? ` (campos: ${resp.json.fields_updated.join(', ')})`
      : '';
    return `${label} OK${fields}. Ledger: ${resp.json.ledger_id}.${resp.json.drift_detected ? ' Drift detectado e re-sincronizado.' : ''}`;
  }
  return `${label} falhou: ${resp.json?.error ?? `HTTP ${resp.status}`}.`;
}

export async function executeUpdateCampaign(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-update-campaign', authHeader, body);
  return summarize('update_campaign', args, resp);
}

export async function executeUpdateAdset(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-update-adset', authHeader, body);
  return summarize('update_adset', args, resp);
}

export async function executeUpdateAd(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-update-ad', authHeader, body);
  return summarize('update_ad', args, resp);
}

export async function executeShiftBudget(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-shift-budget', authHeader, body);
  if (resp.json?.ok && !resp.json?.blocked && !resp.json?.simulated) {
    return `shift_budget OK: R$${args.amount_brl} de ${resp.json.from?.external_id} -> ${resp.json.to?.external_id}. Ledger: ${resp.json.ledger_id}.`;
  }
  return summarize('shift_budget', args, resp);
}

export async function executeChangeSchedule(authHeader: string, args: any): Promise<string> {
  const body = { ...args, triggered_by: args.triggered_by ?? 'agent' };
  const resp = await invoke('meta-change-schedule', authHeader, body);
  return summarize('change_schedule', args, resp);
}
