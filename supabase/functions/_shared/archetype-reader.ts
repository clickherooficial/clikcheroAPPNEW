// Archetype reader — leitura sem cache do business_archetype de uma company.
// Spec: business-archetype-personas (task 2.2)
//
// NOTA: Edge Functions rodam em Deno e nao conseguem importar do `src/`.
// Por isso o type `Archetype` e o array `ARCHETYPE_VALUES` sao redeclarados
// aqui (espelham `src/types/business-archetype.ts`). Se voce alterar um lado,
// atualize o outro.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const ARCHETYPE_VALUES = [
  'small_local_business',
  'online_seller',
  'service_provider',
  'info_product',
] as const;

export type Archetype = typeof ARCHETYPE_VALUES[number];

export function isArchetype(v: unknown): v is Archetype {
  return typeof v === 'string' && (ARCHETYPE_VALUES as readonly string[]).includes(v);
}

/**
 * Le o `business_archetype` da tabela `company_briefings` para a company informada.
 * Sem cache: cada chamada faz um SELECT direto, garantindo que mudancas em
 * Settings reflitam imediato.
 *
 * Retorna `null` se:
 *   - Nao existe row de briefing para a company
 *   - O valor armazenado e null/undefined
 *   - O valor armazenado nao corresponde a um Archetype valido (corrupcao)
 *   - A query falhou (erro de rede, RLS, etc.)
 */
export async function readArchetype(
  client: SupabaseClient,
  companyId: string,
): Promise<Archetype | null> {
  const { data, error } = await client
    .from('company_briefings')
    .select('business_archetype')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.warn('[archetype-reader] erro ao ler business_archetype', {
      companyId,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;

  const value = (data as { business_archetype: unknown }).business_archetype;
  if (value === null || value === undefined) return null;

  if (!isArchetype(value)) {
    console.warn('[archetype-reader] valor invalido em business_archetype', {
      companyId,
      value,
    });
    return null;
  }

  return value;
}
