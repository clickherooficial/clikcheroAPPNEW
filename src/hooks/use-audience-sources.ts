// pixel-engagement-audiences (Sprint 4/8)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  AudienceSourceCacheRow,
  CreatePixelAudiencePayload,
  CreateEngagementAudiencePayload,
} from '@/types/pixel-audiences';
import { AudienceError } from '@/types/audiences';

async function callRule<T = unknown>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('meta-audience-create-rule', { body });
  if (error) throw new AudienceError(error.message ?? 'invoke_failed', { error });
  const resp = data as { ok?: boolean; blocked?: boolean; reason?: string; error?: string; ledger_id?: string };
  if (!resp || resp.ok === false) {
    throw new AudienceError(
      resp.reason ?? resp.error ?? 'unknown',
      resp,
      { blocked: Boolean(resp.blocked), ledgerId: resp.ledger_id },
    );
  }
  return data as T;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['audiences'] });
  qc.invalidateQueries({ queryKey: ['audience-sources'] });
}

export function useAudienceSources() {
  return useQuery({
    queryKey: ['audience-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_audience_sources_cache')
        .select('*')
        .order('kind')
        .order('name');
      if (error) throw error;
      return (data ?? []) as AudienceSourceCacheRow[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useRefreshAudienceSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-list-audience-sources', { body: {} });
      if (error) throw new AudienceError(error.message, { error });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audience-sources'] }),
  });
}

export function useCreatePixelAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePixelAudiencePayload) =>
      callRule({ kind: 'pixel', triggered_by: 'user', ...payload }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateEngagementAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEngagementAudiencePayload) =>
      callRule({ kind: 'engagement', triggered_by: 'user', ...payload }),
    onSuccess: () => invalidate(qc),
  });
}
