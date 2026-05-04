// ab-testing (Sprint 7/8)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ABTest, ABTestCriterion, ABTestKind } from '@/types/ab-tests';

export function useABTests() {
  return useQuery({
    queryKey: ['ab-tests'],
    queryFn: async (): Promise<ABTest[]> => {
      const { data, error } = await supabase
        .from('ab_tests')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ABTest[];
    },
    staleTime: 30_000,
  });
}

export interface StartABTestPayload {
  name: string;
  variant_a_kind: ABTestKind;
  variant_a_external_id: string;
  variant_a_label?: string;
  variant_b_kind: ABTestKind;
  variant_b_external_id: string;
  variant_b_label?: string;
  criterion: ABTestCriterion;
  notes?: string;
}

export function useStartABTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StartABTestPayload) => {
      // resolve company_id automaticamente via current user
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .single();
      const orgId = profile?.current_organization_id;
      if (!orgId) throw new Error('no_organization');
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .single();
      if (!company?.id) throw new Error('no_company');

      const { data, error } = await supabase
        .from('ab_tests')
        .insert({ company_id: company.id, ...payload })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ab-tests'] }),
  });
}

export function useEvaluateABTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string) => {
      const { data, error } = await supabase.functions.invoke('ab-test-evaluate', {
        body: { test_id: testId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ab-tests'] }),
  });
}

export function useEndABTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase
        .from('ab_tests')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', testId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ab-tests'] }),
  });
}
