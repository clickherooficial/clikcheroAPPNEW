// agency-mode (Sprint 8/8)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdAccount {
  account_id: string;
  account_name: string | null;
  account_status: number | string | null;
}

export function useAdAccounts() {
  return useQuery({
    queryKey: ['ad-accounts'],
    queryFn: async () => {
      const [{ data: accounts, error: ae }, { data: profile }] = await Promise.all([
        supabase
          .from('meta_ad_accounts')
          .select('account_id, account_name, account_status')
          .order('account_name'),
        supabase.from('profiles').select('current_organization_id').single(),
      ]);
      if (ae) throw ae;

      let preferred: string | null = null;
      if (profile?.current_organization_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('preferred_ad_account_external_id')
          .eq('organization_id', profile.current_organization_id)
          .single();
        preferred = company?.preferred_ad_account_external_id ?? null;
      }

      return {
        accounts: (accounts ?? []) as AdAccount[],
        preferred,
      };
    },
    staleTime: 60_000,
  });
}

export function useSetPreferredAdAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (externalId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .single();
      if (!profile?.current_organization_id) throw new Error('no_organization');
      const { error } = await supabase
        .from('companies')
        .update({ preferred_ad_account_external_id: externalId })
        .eq('organization_id', profile.current_organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalida tudo — mudanca de conta afeta todos os dados
      qc.invalidateQueries({ queryKey: ['ad-accounts'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['adsets'] });
      qc.invalidateQueries({ queryKey: ['audiences'] });
      qc.invalidateQueries({ queryKey: ['catalogs'] });
      qc.invalidateQueries({ queryKey: ['ab-tests'] });
    },
  });
}
