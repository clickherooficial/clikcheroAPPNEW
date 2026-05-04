// audience-management (Sprint 3/8) — hooks de audiencia.
// PII e hashada client-side via @/lib/sha256 antes de chamar create_customer_list.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hashRows } from '@/lib/sha256';
import {
  AudienceError,
  type CreateCustomerListAudiencePayload,
  type CreateLookalikePayload,
  type DeleteAudiencePayload,
  type MetaAudience,
  type UpdateAudiencePayload,
} from '@/types/audiences';

async function callEdge<T = unknown>(fnName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new AudienceError(error.message ?? 'invoke_failed', { error });
  const resp = data as { ok?: boolean; blocked?: boolean; in_active_use?: boolean; reason?: string; error?: string; ledger_id?: string };
  if (!resp || resp.ok === false) {
    throw new AudienceError(
      resp.reason ?? resp.error ?? 'unknown',
      resp,
      { blocked: Boolean(resp.blocked), inActiveUse: Boolean(resp.in_active_use), ledgerId: resp.ledger_id },
    );
  }
  return data as T;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['audiences'] });
  qc.invalidateQueries({ queryKey: ['audience-usage'] });
  qc.invalidateQueries({ queryKey: ['safety-status'] });
  qc.invalidateQueries({ queryKey: ['safety-ledger'] });
}

export function useAudiences() {
  return useQuery({
    queryKey: ['audiences'],
    queryFn: async (): Promise<MetaAudience[]> => {
      const { data, error } = await supabase
        .from('meta_audiences')
        .select('*')
        .order('local_updated_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as MetaAudience[];
    },
    staleTime: 30_000,
  });
}

export function useAudienceUsage(audienceId: string | null) {
  return useQuery({
    queryKey: ['audience-usage', audienceId],
    queryFn: async () => {
      if (!audienceId) return [];
      const { data, error } = await supabase
        .from('meta_audience_usage')
        .select('*')
        .eq('audience_id', audienceId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(audienceId),
    staleTime: 10_000,
  });
}

export function useSyncAudiences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callEdge('meta-sync-audiences', {}),
    onSuccess: () => invalidateAll(qc),
  });
}

/**
 * Cria Custom Audience. PII raw passa pelo browser, e hashed AQUI antes de subir.
 * Aceita rawData em texto claro como input — server NUNCA recebe.
 */
export function useCreateCustomerListAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateCustomerListAudiencePayload, 'payload'> & {
      rawData: string[][]; schema: CreateCustomerListAudiencePayload['payload']['schema'];
    }) => {
      const hashedData = await hashRows(input.schema, input.rawData);
      const payload: CreateCustomerListAudiencePayload = {
        name: input.name,
        description: input.description,
        customer_file_source: input.customer_file_source ?? 'USER_PROVIDED_ONLY',
        retention_days: input.retention_days,
        triggered_by: input.triggered_by ?? 'user',
        payload: { schema: input.schema, data: hashedData },
      };
      return callEdge('meta-audience-create', payload);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateLookalike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLookalikePayload) =>
      callEdge('meta-audience-lookalike', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAudiencePayload) =>
      callEdge('meta-audience-update', { ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeleteAudiencePayload) =>
      callEdge('meta-audience-delete', { confirm: true, ...payload, triggered_by: payload.triggered_by ?? 'user' }),
    onSuccess: () => invalidateAll(qc),
  });
}
