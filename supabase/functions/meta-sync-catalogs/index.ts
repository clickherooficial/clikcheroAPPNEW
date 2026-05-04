// meta-sync-catalogs — catalog-management (Sprint 6/8)
// Pagina catalogs do business + sets de cada catalog. Upserta local.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveMetaContext, resolveMetaContextByCompanyId, isAdminInvoke, jsonResponse, MetaApiError } from '../_shared/meta-edits-helpers.ts';

const GRAPH = 'https://graph.facebook.com/v22.0';

async function safeGet(url: string): Promise<any> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new MetaApiError(j?.error?.message ?? `get_failed_${r.status}`, j?.error?.code ?? r.status, j?.error);
  return j;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let companyId: string;
  let metaToken: string;

  if (isAdminInvoke(req)) {
    const body = await req.json().catch(() => ({}));
    if (!body?.company_id) return jsonResponse({ error: 'company_id_required' }, 400, cors);
    const r = await resolveMetaContextByCompanyId(supabaseAdmin, body.company_id);
    if (!r.ok) return jsonResponse({ error: r.error }, 422, cors);
    ({ companyId, metaToken } = r.value);
  } else {
    const ctx = await resolveMetaContext(req, supabaseAdmin);
    if (!ctx.ok) return ctx.response;
    ({ companyId, metaToken } = ctx.value);
  }

  let totalCatalogs = 0;
  let totalSets = 0;
  const errors: string[] = [];

  try {
    // 1. Pega businesses do user
    const biz = await safeGet(`${GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(metaToken)}`);
    const businesses = biz.data ?? [];

    for (const b of businesses) {
      // 2. Catalogs do business
      try {
        const catRes = await safeGet(
          `${GRAPH}/${b.id}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${encodeURIComponent(metaToken)}`,
        );
        const catalogs = catRes.data ?? [];

        for (const c of catalogs) {
          // upsert catalog
          const { data: localCat, error: ce } = await supabaseAdmin
            .from('product_catalogs')
            .upsert({
              company_id: companyId,
              external_id: String(c.id),
              name: c.name ?? '(unnamed)',
              business_id: String(b.id),
              product_count: c.product_count ?? null,
              vertical: c.vertical ?? null,
              fetched_at: new Date().toISOString(),
            }, { onConflict: 'company_id,external_id' })
            .select('id')
            .single();

          if (ce || !localCat) {
            errors.push(`catalog ${c.id} upsert failed`);
            continue;
          }
          totalCatalogs += 1;

          // 3. Product sets do catalog
          try {
            const setRes = await safeGet(
              `${GRAPH}/${c.id}/product_sets?fields=id,name,filter,product_count&limit=100&access_token=${encodeURIComponent(metaToken)}`,
            );
            for (const s of (setRes.data ?? [])) {
              const { error: se } = await supabaseAdmin
                .from('product_sets')
                .upsert({
                  company_id: companyId,
                  catalog_id: localCat.id,
                  external_id: String(s.id),
                  name: s.name ?? '(unnamed)',
                  filter: s.filter ?? null,
                  product_count: s.product_count ?? null,
                  fetched_at: new Date().toISOString(),
                }, { onConflict: 'company_id,external_id' });
              if (se) errors.push(`set ${s.id} upsert failed: ${se.message}`);
              else totalSets += 1;
            }
          } catch (e: any) {
            errors.push(`sets fetch failed for catalog ${c.id}: ${e?.message}`);
          }

          // small delay
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch (e: any) {
        errors.push(`catalogs fetch failed for business ${b.id}: ${e?.message}`);
      }
    }

    return jsonResponse({
      ok: true,
      synced_catalogs: totalCatalogs,
      synced_sets: totalSets,
      businesses: businesses.length,
      errors,
    }, 200, cors);
  } catch (err: any) {
    const isMeta = err instanceof MetaApiError;
    return jsonResponse({
      ok: false,
      error: err?.message ?? 'unknown_error',
      meta_error: isMeta ? { code: err.code, graph: err.graphError } : undefined,
    }, isMeta ? 502 : 500, cors);
  }
});
