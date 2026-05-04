// meta-list-audience-sources — pixel-engagement-audiences (Sprint 4/8)
// Lista pixels, pages, IG accounts, videos recentes e lead forms.
// Cache em meta_audience_sources_cache.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  resolveMetaContext,
  resolveMetaContextByCompanyId,
  isAdminInvoke,
  jsonResponse,
  MetaApiError,
} from '../_shared/meta-edits-helpers.ts';

const GRAPH = 'https://graph.facebook.com/v22.0';

async function safeGet(url: string): Promise<any> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new MetaApiError(j?.error?.message ?? `get_failed_${r.status}`, j?.error?.code ?? r.status, j?.error);
  }
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
  let adAccountId: string;
  let metaToken: string;

  if (isAdminInvoke(req)) {
    const body = await req.json().catch(() => ({}));
    if (!body?.company_id) return jsonResponse({ error: 'company_id_required' }, 400, cors);
    const r = await resolveMetaContextByCompanyId(supabaseAdmin, body.company_id);
    if (!r.ok) return jsonResponse({ error: r.error }, 422, cors);
    ({ companyId, adAccountId, metaToken } = r.value);
  } else {
    const ctx = await resolveMetaContext(req, supabaseAdmin);
    if (!ctx.ok) return ctx.response;
    ({ companyId, adAccountId, metaToken } = ctx.value);
  }

  const out = {
    pixels: [] as any[],
    pages: [] as any[],
    ig_accounts: [] as any[],
    videos: [] as any[],
    lead_forms: [] as any[],
  };

  try {
    // 1. Pixels
    try {
      const pix = await safeGet(`${GRAPH}/${adAccountId}/adspixels?fields=id,name,last_fired_time&access_token=${encodeURIComponent(metaToken)}`);
      out.pixels = pix.data ?? [];
    } catch (e) { console.warn('[list-sources] pixels failed', e); }

    // 2. Pages do user
    let pageIds: string[] = [];
    try {
      const pages = await safeGet(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(metaToken)}`);
      out.pages = (pages.data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      pageIds = (pages.data ?? []).map((p: any) => p.id);
    } catch (e) { console.warn('[list-sources] pages failed', e); }

    // 3. IG accounts (via pages)
    for (const pageId of pageIds.slice(0, 5)) {
      try {
        const ig = await safeGet(`${GRAPH}/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(metaToken)}`);
        if (ig.instagram_business_account) {
          out.ig_accounts.push({
            id: ig.instagram_business_account.id,
            username: ig.instagram_business_account.username,
            page_id: pageId,
          });
        }
      } catch (e) { console.warn('[list-sources] ig fetch failed for', pageId, e); }
    }

    // 4. Videos recentes (do primeiro page)
    if (pageIds[0]) {
      try {
        const vids = await safeGet(`${GRAPH}/${pageIds[0]}/videos?fields=id,title,thumbnails{uri}&limit=50&access_token=${encodeURIComponent(metaToken)}`);
        out.videos = (vids.data ?? []).map((v: any) => ({
          id: v.id,
          title: v.title ?? '(sem titulo)',
          thumbnail_url: v.thumbnails?.data?.[0]?.uri ?? null,
          page_id: pageIds[0],
        }));
      } catch (e) { console.warn('[list-sources] videos failed', e); }
    }

    // 5. Lead forms (do primeiro page)
    if (pageIds[0]) {
      try {
        const lf = await safeGet(`${GRAPH}/${pageIds[0]}/leadgen_forms?fields=id,name&access_token=${encodeURIComponent(metaToken)}`);
        out.lead_forms = (lf.data ?? []).map((l: any) => ({ id: l.id, name: l.name, page_id: pageIds[0] }));
      } catch (e) { console.warn('[list-sources] lead_forms failed', e); }
    }

    // Cache: upsert tudo
    const upserts: any[] = [];
    for (const p of out.pixels) upserts.push({ company_id: companyId, kind: 'pixel', external_id: p.id, name: p.name ?? '(unnamed)', metadata: { last_fired_time: p.last_fired_time } });
    for (const p of out.pages) upserts.push({ company_id: companyId, kind: 'page', external_id: p.id, name: p.name });
    for (const i of out.ig_accounts) upserts.push({ company_id: companyId, kind: 'ig_business', external_id: i.id, name: i.username, metadata: { page_id: i.page_id } });
    for (const v of out.videos) upserts.push({ company_id: companyId, kind: 'video', external_id: v.id, name: v.title, metadata: { thumbnail_url: v.thumbnail_url, page_id: v.page_id } });
    for (const f of out.lead_forms) upserts.push({ company_id: companyId, kind: 'lead_form', external_id: f.id, name: f.name, metadata: { page_id: f.page_id } });

    if (upserts.length > 0) {
      const fetched_at = new Date().toISOString();
      const rowsWithFetched = upserts.map((u) => ({ ...u, fetched_at }));
      const { error } = await supabaseAdmin
        .from('meta_audience_sources_cache')
        .upsert(rowsWithFetched, { onConflict: 'company_id,kind,external_id' });
      if (error) console.error('[list-sources] cache upsert failed', error);
    }

    return jsonResponse({ ok: true, ...out, cached_count: upserts.length }, 200, cors);
  } catch (err: any) {
    const isMeta = err instanceof MetaApiError;
    return jsonResponse({
      ok: false,
      error: err?.message ?? 'unknown_error',
      meta_error: isMeta ? { code: err.code, graph: err.graphError } : undefined,
    }, isMeta ? 502 : 500, cors);
  }
});
