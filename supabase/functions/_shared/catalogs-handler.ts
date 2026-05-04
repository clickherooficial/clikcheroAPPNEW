// catalog-management (Sprint 6/8) — handler de list_catalogs.
// deno-lint-ignore-file no-explicit-any

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function listCatalogsHandler(supabase: SupabaseClient, companyId: string): Promise<string> {
  const { data: catalogs, error: ce } = await supabase
    .from('product_catalogs')
    .select('id, external_id, name, product_count, vertical, fetched_at')
    .eq('company_id', companyId)
    .order('name');

  if (ce) return `Erro ao consultar catalogs: ${ce.message}`;
  if (!catalogs || catalogs.length === 0) {
    return 'Nenhum catalog sincronizado. Acesse a view "Catálogos" e clique em "Sincronizar" para puxar do Meta Business.';
  }

  const { data: sets } = await supabase
    .from('product_sets')
    .select('catalog_id, external_id, name, product_count')
    .eq('company_id', companyId);

  const lines = catalogs.map((c: any) => {
    const cSets = (sets ?? []).filter((s: any) => s.catalog_id === c.id);
    const setsBlock = cSets.length === 0
      ? '   (sem product_sets)'
      : cSets.map((s: any) => `   - "${s.name}" (${s.external_id}, ${s.product_count ?? '?'} produtos)`).join('\n');
    return `${c.name} (catalog_id=${c.external_id}, ${c.product_count ?? '?'} produtos)\n${setsBlock}`;
  });

  return `Catalogs disponiveis (${catalogs.length}):\n\n${lines.join('\n\n')}`;
}
