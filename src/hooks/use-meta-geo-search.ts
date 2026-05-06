// Hook para resolver "Cidade" / "Cidade, UF" em city key Meta.
// Spec: .kiro/specs/proposal-edit-geo/

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GeoSearchError =
  | { kind: 'not_found'; message: string }
  | { kind: 'no_meta_connection'; message: string }
  | { kind: 'meta_api'; message: string }
  | { kind: 'validation'; message: string }
  | { kind: 'network'; message: string };

export interface GeoSearchResult {
  key: string;
  name: string;
  summary: string;
  radius_km: number;
}

export type GeoSearchResponse =
  | { ok: true; value: GeoSearchResult }
  | { ok: false; error: GeoSearchError };

interface EdgeErrorBody {
  error?: string;
  message?: string;
}

function mapEdgeError(body: EdgeErrorBody | null, fallback: string): GeoSearchError {
  if (!body || !body.error) return { kind: 'network', message: fallback };
  switch (body.error) {
    case 'not_found':
      return { kind: 'not_found', message: body.message ?? 'Localidade nao encontrada.' };
    case 'no_meta_connection':
      return { kind: 'no_meta_connection', message: body.message ?? 'Conta Meta nao conectada.' };
    case 'meta_api':
      return { kind: 'meta_api', message: body.message ?? 'Erro na API Meta.' };
    case 'validation':
      return { kind: 'validation', message: body.message ?? 'Consulta invalida.' };
    default:
      return { kind: 'network', message: body.message ?? body.error };
  }
}

export function useMetaGeoSearch() {
  const mutation = useMutation({
    mutationFn: async (query: string): Promise<GeoSearchResponse> => {
      const { data, error } = await supabase.functions.invoke<GeoSearchResult>(
        'meta-geo-search',
        { body: { query } },
      );
      if (error) {
        const ctx = (error as { context?: { body?: EdgeErrorBody } }).context;
        return { ok: false, error: mapEdgeError(ctx?.body ?? null, error.message) };
      }
      if (!data) return { ok: false, error: { kind: 'network', message: 'resposta vazia' } };
      return { ok: true, value: data };
    },
  });

  return {
    resolveCity: mutation.mutateAsync,
    isResolving: mutation.isPending,
  };
}
