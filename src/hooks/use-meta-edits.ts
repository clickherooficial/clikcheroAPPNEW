// meta-edits-suite (Sprint 2/8) — hooks de edicao Meta
// 5 mutations + helper de impact preview. Cada mutation invalida 'campaigns', 'adsets'
// e 'safety-status' apos sucesso.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type UpdateCampaignPayload,
  type UpdateAdsetPayload,
  type UpdateAdPayload,
  type ShiftBudgetPayload,
  type ChangeSchedulePayload,
  type MetaEditResponse,
  type BudgetImpactEstimate,
  MetaEditError,
} from '@/types/meta-edits';

async function callEdge<T extends MetaEditResponse>(fnName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) {
    throw new MetaEditError(error.message ?? 'invoke_failed', { error });
  }
  const resp = data as T;
  if (!resp || (resp as MetaEditResponse).ok === false) {
    const r = resp as Exclude<MetaEditResponse, { ok: true }>;
    throw new MetaEditError(
      r.blocked ? `blocked:${(r as { reason: string }).reason}` : (r as { error: string }).error ?? 'unknown',
      r,
      Boolean(r.blocked),
      (r as { ledger_id?: string }).ledger_id,
    );
  }
  return resp;
}

function invalidateCampaignData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['campaigns'] });
  qc.invalidateQueries({ queryKey: ['adsets'] });
  qc.invalidateQueries({ queryKey: ['editable-campaigns'] });
  qc.invalidateQueries({ queryKey: ['safety-status'] });
  qc.invalidateQueries({ queryKey: ['safety-ledger'] });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCampaignPayload) =>
      callEdge('meta-update-campaign', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateCampaignData(qc),
  });
}

export function useUpdateAdset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAdsetPayload) =>
      callEdge('meta-update-adset', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateCampaignData(qc),
  });
}

export function useUpdateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAdPayload) =>
      callEdge('meta-update-ad', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateCampaignData(qc),
  });
}

export function useShiftBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShiftBudgetPayload) =>
      callEdge('meta-shift-budget', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateCampaignData(qc),
  });
}

export function useChangeSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChangeSchedulePayload) =>
      callEdge('meta-change-schedule', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateCampaignData(qc),
  });
}

export function useEditableCampaigns() {
  return useQuery({
    queryKey: ['editable-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_editable_campaigns')
        .select('*')
        .order('local_updated_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useBudgetImpact(campaignId: string | null, newDailyBudget: number | null) {
  return useQuery<BudgetImpactEstimate | { error: string }>({
    queryKey: ['budget-impact', campaignId, newDailyBudget],
    queryFn: async () => {
      if (!campaignId || newDailyBudget == null || newDailyBudget <= 0) {
        return { current_daily: null, new_daily: 0, delta_brl: 0, delta_pct: null, projection_30d_brl: 0 };
      }
      const { data, error } = await supabase.rpc('estimate_budget_change_impact', {
        p_campaign_id: campaignId,
        p_new_daily_budget: newDailyBudget,
      });
      if (error) throw error;
      return data as BudgetImpactEstimate;
    },
    enabled: Boolean(campaignId) && newDailyBudget != null && newDailyBudget > 0,
    staleTime: 5_000,
  });
}
