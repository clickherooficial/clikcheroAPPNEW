// meta-edits-suite (Sprint 2/8)
// Helpers compartilhados pelas 5 Edge Functions de edicao Meta:
// - resolveMetaContext: tenant-guard + decrypt token + ad account
// - metaPatch: POST graph.facebook.com/{id} com fields
// - metaGet: GET graph.facebook.com/{id}?fields=...
// - preflightDriftCheck: compara estado local vs Meta antes de editar (evita sobrescrever mudanca externa)
// - MetaApiError: erro tipado pra distinguir erro de Meta API vs erros locais
// deno-lint-ignore-file no-explicit-any

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from './cors.ts';

export class MetaApiError extends Error {
  code?: number;
  graphError?: any;
  constructor(message: string, code?: number, graphError?: any) {
    super(message);
    this.name = 'MetaApiError';
    this.code = code;
    this.graphError = graphError;
  }
}

export interface MetaEditContext {
  companyId: string;
  userId: string;
  organizationId: string;
  metaToken: string;
  adAccountId: string; // formato 'act_XXXX'
}

export type ResolveMetaContextResult =
  | { ok: true; value: MetaEditContext }
  | { ok: false; response: Response };

/**
 * Resolve { companyId, userId, metaToken, adAccountId } a partir do JWT.
 * Retorna 401 sem token, 404 sem org/integration/ad_account.
 *
 * Uso:
 *   const ctx = await resolveMetaContext(req, supabaseAdmin);
 *   if (!ctx.ok) return ctx.response;
 *   const { companyId, metaToken, adAccountId } = ctx.value;
 */
/**
 * Resolve direto por companyId (path admin/cron).
 * Uso: chamado de Edge Fns server-side que ja validaram x-admin-invoke-secret.
 */
export async function resolveMetaContextByCompanyId(
  supabaseAdmin: SupabaseClient,
  companyId: string,
): Promise<{ ok: true; value: MetaEditContext } | { ok: false; error: string }> {
  const { data: integ } = await supabaseAdmin
    .from('integrations')
    .select('access_token')
    .eq('company_id', companyId)
    .eq('platform', 'meta')
    .single();
  if (!integ?.access_token) return { ok: false, error: 'no_meta_integration' };

  const { data: decrypted } = await supabaseAdmin.rpc('decrypt_meta_token', {
    encrypted_token: integ.access_token,
  });
  if (!decrypted) return { ok: false, error: 'decrypt_failed' };

  const { data: companyPref } = await supabaseAdmin
    .from('companies')
    .select('id, organization_id, preferred_ad_account_external_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!companyPref) return { ok: false, error: 'no_company' };

  let accountExternal: string | null = null;
  if (companyPref.preferred_ad_account_external_id) {
    const { data: prefAcc } = await supabaseAdmin
      .from('meta_ad_accounts')
      .select('account_id')
      .eq('company_id', companyId)
      .eq("account_id", companyPref.preferred_ad_account_external_id)
      .maybeSingle();
    accountExternal = prefAcc?.account_id ?? null;
  }
  if (!accountExternal) {
    const { data: firstAcc } = await supabaseAdmin
      .from('meta_ad_accounts')
      .select('account_id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    accountExternal = firstAcc?.account_id ?? null;
  }
  if (!accountExternal) return { ok: false, error: 'no_ad_account_selected' };

  const adAccountId = String(accountExternal).startsWith('act_')
    ? String(accountExternal)
    : `act_${accountExternal}`;

  return {
    ok: true,
    value: {
      companyId,
      userId: 'system:admin-invoke', // marcador (nao FK usuario real)
      organizationId: companyPref.organization_id as string,
      metaToken: decrypted as string,
      adAccountId,
    },
  };
}

/**
 * Verifica x-admin-invoke-secret. Retorna true se header bate com env ADMIN_INVOKE_SECRET.
 * Uso: caller checa antes de tentar resolveMetaContext padrao.
 */
export function isAdminInvoke(req: Request): boolean {
  const header = req.headers.get('x-admin-invoke-secret');
  const env = Deno.env.get('ADMIN_INVOKE_SECRET');
  return Boolean(header && env && header === env);
}

export async function resolveMetaContext(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<ResolveMetaContextResult> {
  const cors = getCorsHeaders(req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      ok: false,
      response: jsonResponse({ error: 'missing_authorization' }, 401, cors),
    };
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: { user }, error: ue } = await supabaseUser.auth.getUser();
  if (ue || !user) {
    return { ok: false, response: jsonResponse({ error: 'invalid_token' }, 401, cors) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.current_organization_id) {
    return { ok: false, response: jsonResponse({ error: 'no_organization' }, 404, cors) };
  }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('organization_id', profile.current_organization_id)
    .single();
  if (!company) {
    return { ok: false, response: jsonResponse({ error: 'no_company' }, 404, cors) };
  }
  const companyId = company.id as string;

  const { data: integ } = await supabaseAdmin
    .from('integrations')
    .select('access_token')
    .eq('company_id', companyId)
    .eq('platform', 'meta')
    .single();
  if (!integ?.access_token) {
    return { ok: false, response: jsonResponse({ error: 'no_meta_integration' }, 404, cors) };
  }

  const { data: decrypted } = await supabaseAdmin.rpc('decrypt_meta_token', {
    encrypted_token: integ.access_token,
  });
  if (!decrypted) {
    return { ok: false, response: jsonResponse({ error: 'decrypt_failed' }, 500, cors) };
  }

  // Sprint 8 (agency-mode): respeita companies.preferred_ad_account_external_id
  const { data: companyPref } = await supabaseAdmin
    .from('companies')
    .select('preferred_ad_account_external_id')
    .eq('id', companyId)
    .maybeSingle();

  let accountExternal: string | null = null;
  if (companyPref?.preferred_ad_account_external_id) {
    const { data: prefAcc } = await supabaseAdmin
      .from('meta_ad_accounts')
      .select('account_id')
      .eq('company_id', companyId)
      .eq("account_id", companyPref.preferred_ad_account_external_id)
      .maybeSingle();
    accountExternal = prefAcc?.account_id ?? null;
  }
  if (!accountExternal) {
    const { data: firstAcc } = await supabaseAdmin
      .from('meta_ad_accounts')
      .select('account_id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    accountExternal = firstAcc?.account_id ?? null;
  }
  if (!accountExternal) {
    return { ok: false, response: jsonResponse({ error: 'no_ad_account_selected' }, 404, cors) };
  }

  const adAccountId = String(accountExternal).startsWith('act_')
    ? String(accountExternal)
    : `act_${accountExternal}`;

  return {
    ok: true,
    value: {
      companyId,
      userId: user.id,
      organizationId: profile.current_organization_id as string,
      metaToken: decrypted as string,
      adAccountId,
    },
  };
}

/**
 * POST graph.facebook.com/v22.0/{externalId} com fields como x-www-form-urlencoded.
 * Objetos sao serializados como JSON (Meta espera assim pra targeting/promoted_object/etc).
 */
export async function metaPatch(
  externalId: string,
  fields: Record<string, any>,
  token: string,
): Promise<any> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  params.set('access_token', token);

  const res = await fetch(`https://graph.facebook.com/v22.0/${externalId}`, {
    method: 'POST',
    body: params,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MetaApiError(
      json?.error?.message ?? 'meta_api_error',
      json?.error?.code ?? res.status,
      json?.error,
    );
  }
  return json;
}

export async function metaGet(
  externalId: string,
  fields: string[],
  token: string,
): Promise<any> {
  const url = `https://graph.facebook.com/v22.0/${externalId}?fields=${
    encodeURIComponent(fields.join(','))
  }&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MetaApiError(
      json?.error?.message ?? `get_failed_${res.status}`,
      json?.error?.code ?? res.status,
      json?.error,
    );
  }
  return json;
}

/**
 * Pre-flight drift check: compara estado local vs Meta antes de PATCH.
 * Se algum field diferir, retorna drift=true com remote — caller deve abortar (a menos que force=true).
 *
 * Comparacao e feita em String() pra absorver coisas como numeric vs number e centavos vs reais
 * — caller e responsavel por normalizar localState para o formato Meta espera (ex: budgets em centavos).
 */
export async function preflightDriftCheck(
  externalId: string,
  fieldsToCheck: string[],
  localState: Record<string, any>,
  token: string,
): Promise<{ drift: boolean; remote: any; divergedFields: string[] }> {
  const remote = await metaGet(externalId, fieldsToCheck, token);
  const divergedFields: string[] = [];
  for (const f of fieldsToCheck) {
    if (remote[f] === undefined) continue;
    if (localState[f] === undefined || localState[f] === null) continue;
    if (String(remote[f]) !== String(localState[f])) {
      divergedFields.push(f);
    }
  }
  return { drift: divergedFields.length > 0, remote, divergedFields };
}

export function jsonResponse(body: any, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/**
 * Helper que dispara meta-sync incremental em background (best-effort).
 * Nao bloqueia a resposta — se falhar, apenas loga.
 */
export async function fireBackgroundSync(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  scope: 'campaign' | 'adset' | 'ad',
  externalId: string,
): Promise<void> {
  try {
    void supabaseAdmin.functions.invoke('meta-deep-scan', {
      body: { company_id: companyId, scope, external_id: externalId, incremental: true },
    });
  } catch (e) {
    console.warn('[meta-edits] fireBackgroundSync failed', e);
  }
}
