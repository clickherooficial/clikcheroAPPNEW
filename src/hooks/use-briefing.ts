// Hook canonico do briefing: leitura + writes por passo + CRUD de ofertas.
// Spec: .kiro/specs/briefing-onboarding/ (task 4.1)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type {
  BriefingError,
  CompanyBriefing,
  CompanyOffer,
  Result,
} from '@/types/briefing';
import type { Archetype } from '@/types/business-archetype';

const BRIEFING_STALE_MS = 5 * 60 * 1000;

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

function toError(message: unknown): BriefingError {
  return {
    kind: 'network',
    message: typeof message === 'string' ? message : 'Erro de rede',
  };
}

export function useBriefing() {
  const { company, role } = useAuth();
  const companyId = company?.id ?? null;
  const isReadOnly = role !== 'owner' && role !== 'admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const briefingQuery = useQuery({
    queryKey: ['briefing', companyId],
    enabled: !!companyId,
    staleTime: BRIEFING_STALE_MS,
    queryFn: async (): Promise<CompanyBriefing | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('company_briefings' as never)
        .select(
          'company_id, niche, niche_category, short_description, website_url, social_links, audience, tone, palette, status, business_archetype, created_at, updated_at',
        )
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CompanyBriefing) ?? null;
    },
  });

  const offersQuery = useQuery({
    queryKey: ['briefing-offers', companyId],
    enabled: !!companyId,
    staleTime: BRIEFING_STALE_MS,
    queryFn: async (): Promise<CompanyOffer[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_offers' as never)
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false })
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as unknown as CompanyOffer[]) ?? [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['briefing', companyId] });
    queryClient.invalidateQueries({ queryKey: ['briefing-offers', companyId] });
    queryClient.invalidateQueries({ queryKey: ['briefing-status', companyId] });
  };

  const saveStepMutation = useMutation({
    mutationFn: async (params: {
      step: WizardStep;
      partial: Partial<CompanyBriefing>;
    }): Promise<Result<CompanyBriefing, BriefingError>> => {
      if (!companyId) return { ok: false, error: { kind: 'unauthorized' } };
      if (isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const payload = { ...params.partial, company_id: companyId };
      const { data, error } = await supabase
        .from('company_briefings' as never)
        .upsert(payload as never, { onConflict: 'company_id' })
        .select()
        .single();
      if (error) return { ok: false, error: toError(error.message) };
      return { ok: true, value: data as unknown as CompanyBriefing };
    },
    onSuccess: invalidateAll,
  });

  const upsertOfferMutation = useMutation({
    mutationFn: async (
      offer: Partial<CompanyOffer> & { id?: string },
    ): Promise<Result<CompanyOffer, BriefingError>> => {
      if (!companyId) return { ok: false, error: { kind: 'unauthorized' } };
      if (isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const required = ['name', 'short_description', 'price', 'format'] as const;
      const missing = required.filter((k) => offer[k] === undefined || offer[k] === null || offer[k] === '');
      if (missing.length > 0) {
        return { ok: false, error: { kind: 'validation', fields: missing } };
      }
      const payload = { ...offer, company_id: companyId };
      const { data, error } = await supabase
        .from('company_offers' as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) return { ok: false, error: toError(error.message) };
      return { ok: true, value: data as unknown as CompanyOffer };
    },
    onSuccess: invalidateAll,
  });

  const removeOfferMutation = useMutation({
    mutationFn: async (offerId: string): Promise<Result<void, BriefingError>> => {
      if (!companyId || isReadOnly) {
        return { ok: false, error: { kind: 'unauthorized' } };
      }
      // R6.6: nao deixa remover oferta principal se for a unica
      const offers = offersQuery.data ?? [];
      const target = offers.find((o) => o.id === offerId);
      if (target?.is_primary && offers.filter((o) => o.is_primary).length === 1 && offers.length > 1) {
        return { ok: false, error: { kind: 'conflict', reason: 'must_keep_one_primary_offer' } };
      }
      const { error } = await supabase
        .from('company_offers' as never)
        .delete()
        .eq('id', offerId);
      if (error) return { ok: false, error: toError(error.message) };
      return { ok: true, value: undefined };
    },
    onSuccess: invalidateAll,
  });

  const promotePrimaryMutation = useMutation({
    mutationFn: async (offerId: string): Promise<Result<void, BriefingError>> => {
      if (!companyId || isReadOnly) {
        return { ok: false, error: { kind: 'unauthorized' } };
      }
      // RPC atomica (demote + promote em uma transacao). Fix M2 do code review.
      const { error } = await supabase.rpc(
        'promote_offer_to_primary' as never,
        { p_offer_id: offerId } as never,
      );
      if (error) return { ok: false, error: toError(error.message) };
      return { ok: true, value: undefined };
    },
    onSuccess: invalidateAll,
  });

  // Task 7.1 (business-archetype-personas): mutation pra setar archetype manualmente do Settings.
  const updateArchetypeMutation = useMutation({
    mutationFn: async (value: Archetype | null) => {
      if (!companyId) throw new Error('Empresa nao identificada');
      if (isReadOnly) throw new Error('Sem permissao para editar');
      const { error } = await supabase
        .from('company_briefings' as never)
        .update({ business_archetype: value } as never)
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefing', companyId] });
      toast({
        title: 'Arquetipo atualizado',
        description: 'Suas sugestoes foram personalizadas.',
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar',
        description: message,
        variant: 'destructive',
      });
    },
  });

  return {
    briefing: briefingQuery.data ?? null,
    offers: offersQuery.data ?? [],
    isLoading: briefingQuery.isLoading || offersQuery.isLoading,
    isError: briefingQuery.isError || offersQuery.isError,
    isReadOnly,
    saveStep: (step: WizardStep, partial: Partial<CompanyBriefing>) =>
      saveStepMutation.mutateAsync({ step, partial }),
    upsertOffer: upsertOfferMutation.mutateAsync,
    removeOffer: removeOfferMutation.mutateAsync,
    promoteOfferToPrimary: promotePrimaryMutation.mutateAsync,
    updateArchetype: updateArchetypeMutation.mutate,
    isUpdatingArchetype: updateArchetypeMutation.isPending,
  };
}
