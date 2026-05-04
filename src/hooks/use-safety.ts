/**
 * Hooks pra agent-safety-rails.
 * Spec: .kiro/specs/agent-safety-rails/
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type {
  ActionLedgerRow,
  LedgerStatus,
  SafetyConfigPatch,
  SafetyStatus,
  TriggeredBy,
} from '@/types/safety';

const STATUS_STALE_MS = 30 * 1000; // 30s

export function useSafetyStatus() {
  return useQuery<SafetyStatus | null>({
    queryKey: ['safety-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_safety_status');
      if (error) throw new Error(error.message);
      if (!data || (typeof data === 'object' && 'error' in data && data.error)) {
        return null;
      }
      return data as SafetyStatus;
    },
    refetchInterval: STATUS_STALE_MS,
    staleTime: STATUS_STALE_MS,
  });
}

export function useUpdateSafetyConfig() {
  const qc = useQueryClient();
  const { company } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (patch: SafetyConfigPatch) => {
      if (!company?.id) throw new Error('no_company');
      const { data, error } = await supabase
        .from('agent_safety_config')
        .update(patch)
        .eq('company_id', company.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['safety-status'] });
      toast({ title: 'Configuracao atualizada', description: 'Aplicada na proxima acao.' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Falha ao atualizar configuracao',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResetCircuitBreaker() {
  const qc = useQueryClient();
  const { company } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('no_company');
      const { error } = await supabase
        .from('agent_safety_config')
        .update({ paused_until: null, paused_reason: null })
        .eq('company_id', company.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['safety-status'] });
      qc.invalidateQueries({ queryKey: ['action-ledger'] });
      toast({
        title: 'Circuit breaker resetado',
        description: 'Agente pode executar acoes novamente.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Falha ao resetar', description: err.message, variant: 'destructive' });
    },
  });
}

export interface ActionLedgerFilter {
  status?: LedgerStatus | 'all';
  agentName?: string;
  triggeredBy?: TriggeredBy | 'all';
  limit?: number;
}

export function useActionLedger(filter?: ActionLedgerFilter) {
  return useQuery<ActionLedgerRow[]>({
    queryKey: ['action-ledger', filter],
    queryFn: async () => {
      let query = supabase
        .from('agent_action_ledger')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(filter?.limit ?? 50);

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      if (filter?.agentName) {
        query = query.eq('agent_name', filter.agentName);
      }
      if (filter?.triggeredBy && filter.triggeredBy !== 'all') {
        query = query.eq('triggered_by', filter.triggeredBy);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as ActionLedgerRow[];
    },
    refetchInterval: 15_000,
  });
}
