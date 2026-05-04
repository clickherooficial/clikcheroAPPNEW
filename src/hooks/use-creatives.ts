// Hook canonico de criativos gerados — listagem + mutations.
// Spec: .kiro/specs/ai-creative-generation/ (task 8.1)
//
// Read direto na tabela creatives_generated (RLS aplica). Mutations:
//   - approve / discard: UPDATE status (RLS owner/admin)
//   - updateMetadata: UPDATE colunas user-facing
//   - iterate / vary: invoke('creative-iterate')
//   - generate: invoke('creative-generate')  -- usado pela tool do chat
//   - exportZip: invoke('creative-export')
//
// Erros sao traduzidos pra CreativeError discriminated union.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  SIGNED_URL_TTL_SEC,
  type Creative,
  type CreativeError,
  type CreativeFilters,
  type CreativeMetadataPatch,
  type ExportResponse,
  type GenerateRequest,
  type GenerateResponse,
  type IterateRequest,
  type IterateResponse,
  type Result,
} from '@/types/creative';

const BUCKET = 'generated-creatives';
const STALE_MS = 60 * 1000;

// ============================================================
// Error mapping
// ============================================================
type EdgeErrorBody = {
  error?: string;
  dimensions?: unknown;
  hits?: unknown;
  missingFields?: unknown;
  score?: unknown;
  message?: string;
  failed_count?: number;
  issues?: unknown;
};

function mapEdgeError(body: EdgeErrorBody | null, fallback: string): CreativeError {
  if (!body || !body.error) return { kind: 'network', message: fallback };
  switch (body.error) {
    case 'quota_exceeded':
      return { kind: 'quota_exceeded', dimensions: (body.dimensions as never) ?? [] };
    case 'briefing_incomplete':
      return {
        kind: 'briefing_incomplete',
        missingFields: Array.isArray(body.missingFields) ? body.missingFields as string[] : [],
        score: typeof body.score === 'number' ? body.score : 0,
      };
    case 'plan_upgrade_required':
      return { kind: 'plan_upgrade_required', message: body.message ?? 'Plano insuficiente.' };
    case 'forbidden_by_briefing':
      return { kind: 'forbidden_by_briefing', hits: Array.isArray(body.hits) ? body.hits as string[] : [] };
    case 'forbidden_by_blocklist':
      return { kind: 'forbidden_by_blocklist', hits: Array.isArray(body.hits) ? body.hits as never : [] };
    case 'provider_unavailable':
      return { kind: 'provider_unavailable', failed_count: body.failed_count ?? 0 };
    case 'timeout_total':
    case 'timeout':
      return { kind: 'timeout' };
    case 'validation':
      return { kind: 'validation', issues: body.issues };
    default:
      return { kind: 'network', message: body.message ?? body.error };
  }
}

function toNetworkError(msg: unknown): CreativeError {
  return {
    kind: 'network',
    message: typeof msg === 'string' ? msg : (msg instanceof Error ? msg.message : 'erro de rede'),
  };
}

// ============================================================
// Helpers
// ============================================================
async function enrichWithSignedUrl<T extends { storage_path: string }>(row: T): Promise<T & { signed_url?: string }> {
  const { data } = await supabase.storage
    .from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SEC);
  return { ...row, signed_url: data?.signedUrl };
}

// ============================================================
// Hook
// ============================================================
export function useCreatives() {
  const { company, role } = useAuth();
  const companyId = company?.id ?? null;
  const isReadOnly = role !== 'owner' && role !== 'admin';
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<CreativeFilters>({});

  const listQuery = useQuery({
    queryKey: ['creatives', companyId, filters],
    enabled: !!companyId,
    staleTime: STALE_MS,
    queryFn: async (): Promise<Creative[]> => {
      if (!companyId) return [];

      let q = supabase
        .from('creatives_generated' as never)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (filters.status?.length) q = q.in('status', filters.status);
      if (filters.format?.length) q = q.in('format', filters.format);
      if (filters.tags?.length) q = q.overlaps('tags', filters.tags);
      if (filters.from) q = q.gte('created_at', filters.from);
      if (filters.to) q = q.lte('created_at', filters.to);
      if (filters.search?.trim()) {
        const s = `%${filters.search.trim()}%`;
        q = q.or(`title.ilike.${s},concept.ilike.${s},description.ilike.${s}`);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;

      const rows = ((data ?? []) as unknown) as Creative[];
      return Promise.all(rows.map(enrichWithSignedUrl));
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['creatives', companyId] });
    queryClient.invalidateQueries({ queryKey: ['creative-usage', companyId] });
  };

  // Fase 6 (T6.3): realtime de creatives_generated — refetch quando pipeline_status muda
  // Channel name unico por mount pra evitar erro "cannot add callbacks after subscribe"
  // (StrictMode + removeChannel async => mount 2 reutiliza nome em estado stale)
  useEffect(() => {
    if (!companyId) return;
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`creatives-generated-${companyId}-${uniqueId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'creatives_generated', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['creatives', companyId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  const setFilters = (
    f: Partial<CreativeFilters> | ((prev: CreativeFilters) => CreativeFilters),
  ) => {
    setFiltersState((prev) => typeof f === 'function' ? f(prev) : { ...prev, ...f });
  };

  // ============ APPROVE ============
  const approveMutation = useMutation({
    mutationFn: async (id: string): Promise<Result<Creative, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const { data, error } = await supabase
        .from('creatives_generated' as never)
        .update({ status: 'approved' } as never)
        .eq('id', id)
        .select()
        .single();
      if (error) return { ok: false, error: toNetworkError(error.message) };
      return { ok: true, value: data as unknown as Creative };
    },
    onSuccess: invalidate,
  });

  // ============ DISCARD ============
  const discardMutation = useMutation({
    mutationFn: async (id: string): Promise<Result<void, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const { error } = await supabase
        .from('creatives_generated' as never)
        .update({ status: 'discarded' } as never)
        .eq('id', id);
      if (error) return { ok: false, error: toNetworkError(error.message) };
      return { ok: true, value: undefined };
    },
    onSuccess: invalidate,
  });

  // ============ UPDATE METADATA ============
  const updateMetadataMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      patch: CreativeMetadataPatch;
    }): Promise<Result<Creative, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const { data, error } = await supabase
        .from('creatives_generated' as never)
        .update(params.patch as never)
        .eq('id', params.id)
        .select()
        .single();
      if (error) return { ok: false, error: toNetworkError(error.message) };
      return { ok: true, value: data as unknown as Creative };
    },
    onSuccess: invalidate,
  });

  // ============ GENERATE (via Edge Fn) ============
  const generateMutation = useMutation({
    mutationFn: async (req: GenerateRequest): Promise<Result<GenerateResponse, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const { data, error } = await supabase.functions.invoke<GenerateResponse>(
        'creative-generate',
        { body: req },
      );
      if (error) {
        const ctx = (error as { context?: { body?: EdgeErrorBody } }).context;
        return { ok: false, error: mapEdgeError(ctx?.body ?? null, error.message) };
      }
      if (!data) return { ok: false, error: toNetworkError('resposta vazia') };
      return { ok: true, value: data };
    },
    onSuccess: invalidate,
  });

  // ============ ITERATE (via Edge Fn) ============
  const iterateMutation = useMutation({
    mutationFn: async (req: IterateRequest): Promise<Result<IterateResponse, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      const { data, error } = await supabase.functions.invoke<IterateResponse>(
        'creative-iterate',
        { body: req },
      );
      if (error) {
        const ctx = (error as { context?: { body?: EdgeErrorBody } }).context;
        return { ok: false, error: mapEdgeError(ctx?.body ?? null, error.message) };
      }
      if (!data) return { ok: false, error: toNetworkError('resposta vazia') };
      return { ok: true, value: data };
    },
    onSuccess: invalidate,
  });

  // ============ VARY ============ (sugar sobre iterate)
  const varyMutation = useMutation({
    mutationFn: async (parentId: string): Promise<Result<IterateResponse, CreativeError>> => {
      return iterateMutation.mutateAsync({
        parent_creative_id: parentId,
        mode: 'vary',
        count: 3,
      });
    },
  });

  // ============ EXPORT ZIP ============
  const exportZipMutation = useMutation({
    mutationFn: async (creative_ids: string[]): Promise<Result<ExportResponse, CreativeError>> => {
      if (!companyId || isReadOnly) return { ok: false, error: { kind: 'unauthorized' } };
      if (creative_ids.length === 0) {
        return { ok: false, error: { kind: 'validation', issues: 'creative_ids vazio' } };
      }
      const { data, error } = await supabase.functions.invoke<ExportResponse>(
        'creative-export',
        { body: { creative_ids } },
      );
      if (error) {
        const ctx = (error as { context?: { body?: EdgeErrorBody } }).context;
        return { ok: false, error: mapEdgeError(ctx?.body ?? null, error.message) };
      }
      if (!data) return { ok: false, error: toNetworkError('resposta vazia') };
      return { ok: true, value: data };
    },
  });

  return {
    creatives: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    isReadOnly,
    filters,
    setFilters,
    approve: approveMutation.mutateAsync,
    discard: discardMutation.mutateAsync,
    updateMetadata: updateMetadataMutation.mutateAsync,
    generate: generateMutation.mutateAsync,
    iterate: iterateMutation.mutateAsync,
    vary: varyMutation.mutateAsync,
    exportZip: exportZipMutation.mutateAsync,
    enrichWithSignedUrl,
  };
}
