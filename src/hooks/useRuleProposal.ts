// Mutations para aceitar/rejeitar/editar propostas de regra do chat.
// Spec: .kiro/specs/fury-learning/ (T3.4, T3.5)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { ProposedRulePayload, RuleType } from '@/types/fury-rules';

interface AcceptArgs {
  messageId: string;
  proposed: ProposedRulePayload;
  edited?: boolean;
}

interface RejectArgs {
  messageId: string;
  ruleType: RuleType;
  /** Evita SELECT pos-RPC (RLS/cache); vem do envelope no card */
  confidence?: number | null;
}

async function setMessageProposalStatus(messageId: string, status: 'accepted' | 'rejected') {
  const { error } = await supabase.rpc('set_message_proposal_status' as never, {
    p_message_id: messageId,
    p_new_status: status,
  } as never);
  if (error) throw new Error(error.message || 'Falha ao atualizar status');
}

export function useAcceptRuleProposal() {
  const { company, user } = useAuth();
  const companyId = company?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, proposed, edited }: AcceptArgs) => {
      if (!companyId) throw new Error('Sem empresa associada');

      const behaviorInsert = {
        company_id: companyId,
        created_by: user?.id ?? null,
        name: proposed.name,
        description: proposed.description,
        scope: proposed.scope,
        proposal_status: 'accepted' as const,
        confidence: proposed.confidence,
        learned_from_message_id: messageId,
        original_text: proposed.reasoning,
        is_enabled: true,
      };

      let ruleId: string | null = null;

      if (proposed.rule_type === 'behavior') {
        const { data, error } = await supabase
          .from('behavior_rules' as never)
          .insert(behaviorInsert as never)
          .select('id')
          .single();
        if (error) throw error;
        ruleId = (data as { id: string }).id;
      } else if (proposed.rule_type === 'creative_pipeline') {
        // creative_pipeline_rules NAO tem coluna scope — scope fica em applies_to
        const transformType = proposed.transform?.transform_type ?? 'custom';
        const { data, error } = await supabase
          .from('creative_pipeline_rules' as never)
          .insert({
            company_id: companyId,
            created_by: user?.id ?? null,
            name: proposed.name,
            description: proposed.description,
            transform_type: transformType,
            transform_params: proposed.transform?.params ?? {},
            applies_to: { media_types: ['image'], scope: proposed.scope },
            priority: 100,
            proposal_status: 'accepted' as const,
            confidence: proposed.confidence,
            learned_from_message_id: messageId,
            original_text: proposed.reasoning,
            is_enabled: true,
          } as never)
          .select('id')
          .single();
        if (error) throw error;
        ruleId = (data as { id: string }).id;
      } else if (proposed.rule_type === 'action') {
        // fury_rules tem schema diferente
        const trig = proposed.trigger ?? {};
        const act = proposed.action ?? {};
        const { data, error } = await supabase
          .from('fury_rules' as never)
          .insert({
            company_id: companyId,
            display_name: proposed.name,
            description: proposed.description,
            rule_key: `learned_${Date.now()}`,
            action_type: act.type ?? 'alert',
            threshold_value: trig.value ?? 0,
            threshold_unit: trig.metric ?? 'cpl',
            consecutive_days: trig.consecutive_days ?? 1,
            auto_execute: act.type === 'pause',
            is_enabled: true,
            proposal_status: 'accepted',
            confidence: proposed.confidence,
            learned_from_message_id: messageId,
            original_text: proposed.reasoning,
          } as never)
          .select('id')
          .single();
        if (error) throw error;
        ruleId = (data as { id: string }).id;
      }

      // UPDATE mensagem -> status accepted (via RPC SECURITY DEFINER)
      await setMessageProposalStatus(messageId, 'accepted');

      const { error: evtErr } = await supabase.from('rule_proposal_events' as never).insert({
        company_id: companyId,
        user_id: user?.id ?? null,
        message_id: messageId,
        rule_type: proposed.rule_type,
        action: edited ? 'edited' : 'accepted',
        rule_id: ruleId,
        confidence: proposed.confidence,
      } as never);
      if (evtErr) console.warn('[useAcceptRuleProposal] rule_proposal_events:', evtErr.message);

      return { ruleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fury-rules'] });
      queryClient.invalidateQueries({ queryKey: ['rule-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}

export function useRejectRuleProposal() {
  const { company, user } = useAuth();
  const companyId = company?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, ruleType, confidence }: RejectArgs) => {
      if (!companyId) throw new Error('Sem empresa associada');

      await setMessageProposalStatus(messageId, 'rejected');

      const conf = confidence ?? null;
      const { error: evtErr } = await supabase.from('rule_proposal_events' as never).insert({
        company_id: companyId,
        user_id: user?.id ?? null,
        message_id: messageId,
        rule_type: ruleType,
        action: 'rejected',
        confidence: conf,
      } as never);
      if (evtErr) {
        console.warn('[useRejectRuleProposal] rule_proposal_events (nao bloqueia descarte):', evtErr.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}
