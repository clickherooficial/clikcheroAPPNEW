// agency-mode (Sprint 8/8) — handlers no chat.
// deno-lint-ignore-file no-explicit-any

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function getAdAccounts(supabase: SupabaseClient, companyId: string): Promise<string> {
  const [{ data: accounts }, { data: company }] = await Promise.all([
    supabase
      .from('meta_ad_accounts')
      .select('account_id, account_name, account_status')
      .eq('company_id', companyId)
      .order('account_name'),
    supabase
      .from('companies')
      .select('preferred_ad_account_external_id')
      .eq('id', companyId)
      .single(),
  ]);

  if (!accounts || accounts.length === 0) {
    return 'Nenhuma ad_account conectada. Conecte via OAuth (View Configurações).';
  }

  const preferred = company?.preferred_ad_account_external_id;
  return accounts.map((a: any) => {
    const isPref = a.account_id === preferred;
    const star = isPref ? '⭐ ' : '';
    return `${star}${a.account_name ?? a.account_id} (id=${a.account_id}, status=${a.account_status ?? '?'})`;
  }).join('\n');
}

export async function setPreferredAdAccount(supabase: SupabaseClient, companyId: string, args: any): Promise<string> {
  const { data: account } = await supabase
    .from('meta_ad_accounts')
    .select('account_id, account_name')
    .eq('company_id', companyId)
    .eq('account_id', args.external_id)
    .maybeSingle();

  if (!account) return `Ad account "${args.external_id}" nao pertence a esta company.`;

  const { error } = await supabase
    .from('companies')
    .update({ preferred_ad_account_external_id: args.external_id })
    .eq('id', companyId);

  if (error) return `Falha ao salvar preferencia: ${error.message}`;
  return `Conta ativa agora e "${account.account_name ?? args.external_id}" (${args.external_id}).`;
}
