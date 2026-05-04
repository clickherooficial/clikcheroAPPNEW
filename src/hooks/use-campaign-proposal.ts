// Hook do dominio chat-publish-flow.
// Spec: .kiro/specs/chat-publish-flow/ (task 5.1)
//
// Fetch + realtime + mutations sobre uma linha de campaign_proposals,
// alimentando o InlineCampaignProposalCard renderizado dentro do chat.

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  CampaignProposal,
  CampaignProposalPayload,
} from '@/types/campaign-proposal';

const STALE_MS = 30_000;

export function useCampaignProposal(proposalId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['campaign-proposal', proposalId] as const;

  const query = useQuery<CampaignProposal | null>({
    queryKey,
    enabled: !!proposalId,
    staleTime: STALE_MS,
    queryFn: async () => {
      if (!proposalId) return null;
      const { data, error } = await supabase
        .from('campaign_proposals' as never)
        .select(
          'id, company_id, conversation_id, created_by_message_id, creative_id, payload_jsonb, compliance_jsonb, status, publication_id, error_payload, created_at, updated_at, expires_at',
        )
        .eq('id', proposalId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CampaignProposal | null) ?? null;
    },
  });

  // Realtime — invalida ao receber UPDATE da propria proposta
  useEffect(() => {
    if (!proposalId) return;
    const channel = supabase
      .channel(`campaign-proposal-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_proposals',
          filter: `id=eq.${proposalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, queryClient, queryKey]);

  // Cancelar (UPDATE status='cancelled')
  const cancelMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!proposalId) throw new Error('proposalId nulo');
      const { error } = await supabase
        .from('campaign_proposals' as never)
        .update({ status: 'cancelled' } as never)
        .eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Proposta cancelada', description: 'Voce pode pedir uma nova a qualquer momento.' });
    },
    onError: (err) => {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Editar (merge profundo no payload_jsonb).
  // Patch e mesclado no client (read-modify-write); RLS permite UPDATE pelo proprio tenant.
  const editMutation = useMutation({
    mutationFn: async (patch: Partial<CampaignProposalPayload>): Promise<void> => {
      if (!proposalId) throw new Error('proposalId nulo');
      const current = query.data;
      if (!current) throw new Error('proposta nao carregada');
      const merged: CampaignProposalPayload = {
        ...current.payload_jsonb,
        ...patch,
        // Merges nestáveis manuais para audience/copy/prereq/creative
        audience: { ...current.payload_jsonb.audience, ...(patch.audience ?? {}) },
        copy: { ...current.payload_jsonb.copy, ...(patch.copy ?? {}) },
      };
      const { error } = await supabase
        .from('campaign_proposals' as never)
        .update({ payload_jsonb: merged } as never)
        .eq('id', proposalId)
        .eq('status', 'pending_approval'); // so edita enquanto pendente
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Proposta atualizada', description: 'Confira o resumo antes de publicar.' });
    },
    onError: (err) => {
      toast({
        title: 'Erro ao editar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    cancel: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    edit: editMutation.mutateAsync,
    isEditing: editMutation.isPending,
  };
}
