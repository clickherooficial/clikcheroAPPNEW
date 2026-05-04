// catalog-management (Sprint 6/8)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductCatalog, ProductSet } from '@/types/catalogs';

export function useCatalogs() {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: async () => {
      const [{ data: cats, error: ce }, { data: sets, error: se }] = await Promise.all([
        supabase.from('product_catalogs').select('*').order('name'),
        supabase.from('product_sets').select('*').order('name'),
      ]);
      if (ce) throw ce;
      if (se) throw se;
      return {
        catalogs: (cats ?? []) as ProductCatalog[],
        sets: (sets ?? []) as ProductSet[],
      };
    },
    staleTime: 60_000,
  });
}

export function useSyncCatalogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-sync-catalogs', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogs'] }),
  });
}
