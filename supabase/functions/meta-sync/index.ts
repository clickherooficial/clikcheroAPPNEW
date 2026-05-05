import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { extractConversasIniciadas, extractCustoConversa } from '../_shared/insights-conversions.ts';

/**
 * Sincroniza campanhas, metricas e criativos da Meta Graph API
 * para todas as ad accounts selecionadas pela empresa.
 *
 * Processa em batches de 5 para evitar rate limit.
 */

const GRAPH_VERSION = Deno.env.get('META_GRAPH_API_VERSION') ?? 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const BATCH_SIZE = 5;

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  created_time?: string;
  // meta-edits-suite (Sprint 2): campos editaveis populados aqui pra update_campaign comparar com remoto
  bid_strategy?: string;
  bid_amount?: string;
  start_time?: string;
  stop_time?: string;
  spend_cap?: string;
}

interface MetaInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  reach?: string;
  frequency?: string;
  unique_clicks?: string;
  unique_ctr?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  website_purchase_roas?: Array<{ action_type: string; value: string }>;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  campaign_id?: string;
  adset_id?: string;
  creative?: {
    id: string;
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
    video_id?: string;
    call_to_action_type?: string;
    object_type?: string;
    effective_object_story_id?: string;
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // Dual auth: JWT do usuario OU x-cron-secret (chamadas internas)
    const cronSecretHeader = req.headers.get('x-cron-secret');
    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const isCronCall = !!cronSecretHeader && !!cronSecretEnv && cronSecretHeader === cronSecretEnv;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let companyId: string;

    if (isCronCall) {
      let body: { company_id?: string } = {};
      try { body = await req.json(); } catch { /* ignore */ }
      if (!body.company_id) {
        return new Response(JSON.stringify({ error: 'company_id requerido em chamadas internas' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      companyId = body.company_id;
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.current_organization_id) {
        return new Response(JSON.stringify({ error: 'Organizacao nao encontrada' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('organization_id', profile.current_organization_id)
        .single();

      if (!company) {
        return new Response(JSON.stringify({ error: 'Empresa nao encontrada' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      companyId = company.id;
    }

    // Get integration + decrypt token
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('id, access_token, status')
      .eq('company_id', companyId)
      .eq('platform', 'meta')
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Integracao Meta nao encontrada' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: decryptedToken, error: decryptError } = await supabaseAdmin
      .rpc('decrypt_meta_token', { encrypted_token: integration.access_token });

    if (decryptError || !decryptedToken) {
      return new Response(JSON.stringify({ error: 'Falha ao descriptografar token' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Get selected ad accounts
    const { data: adAccounts } = await supabaseAdmin
      .from('meta_ad_accounts')
      .select('account_id, account_name')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (!adAccounts || adAccounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma conta de anuncio selecionada. Selecione contas em Integracoes.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const stats = {
      accounts_processed: 0,
      campaigns_synced: 0,
      metrics_synced: 0,
      creatives_synced: 0,
      errors: [] as string[],
    };

    // Process accounts in batches of BATCH_SIZE
    for (let i = 0; i < adAccounts.length; i += BATCH_SIZE) {
      const batch = adAccounts.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (account) => {
          try {
            await syncAccount(
              supabaseAdmin as any,
              decryptedToken,
              integration.id,
              companyId,
              account.account_id,
              account.account_name ?? '',
              stats
            );
            stats.accounts_processed++;
          } catch (err) {
            console.error(`Failed to sync account ${account.account_id}:`, err);
            stats.errors.push(`${account.account_id}: ${(err as Error).message}`);
          }
        })
      );
    }

    // Update integration last_sync
    await supabaseAdmin
      .from('integrations')
      .update({
        last_sync: new Date().toISOString(),
        last_full_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

// ========== SYNC LOGIC ==========

async function syncAccount(
  supabase: any,
  token: string,
  integrationId: string,
  companyId: string,
  accountId: string,
  accountName: string,
  stats: { campaigns_synced: number; metrics_synced: number; creatives_synced: number }
) {
  // Account ID may already have act_ prefix
  const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

  // ===== 1. Sync campaigns =====
  const campaignsUrl =
    `${GRAPH_BASE}/${actId}/campaigns` +
    `?fields=id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,created_time,bid_strategy,bid_amount,start_time,stop_time,spend_cap` +
    `&limit=100&access_token=${token}`;

  const campaignsResp = await fetch(campaignsUrl);
  const campaignsData = await campaignsResp.json();

  if (campaignsData.error) {
    throw new Error(`Campaigns API: ${campaignsData.error.message}`);
  }

  const campaigns: MetaCampaign[] = campaignsData.data ?? [];
  const campaignIdMap = new Map<string, string>(); // external_id -> internal uuid

  for (const c of campaigns) {
    const dailyBudget = c.daily_budget ? Number(c.daily_budget) / 100 : null;
    const lifetimeBudget = c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null;
    const budget = dailyBudget ?? lifetimeBudget;
    const bidAmount = c.bid_amount ? Number(c.bid_amount) / 100 : null;
    const spendCap = c.spend_cap ? Number(c.spend_cap) / 100 : null;

    const { data: upserted } = await supabase
      .from('campaigns')
      .upsert(
        {
          external_id: c.id,
          name: c.name,
          platform: 'meta',
          status: c.status,
          effective_status: c.effective_status ?? null,
          objective: c.objective ?? null,
          buying_type: c.buying_type ?? null,
          budget,
          // Sprint 2 (meta-edits-suite): campos especificos pra update_campaign
          daily_budget: dailyBudget,
          lifetime_budget: lifetimeBudget,
          bid_strategy: c.bid_strategy ?? null,
          bid_amount: bidAmount,
          start_time: c.start_time ?? null,
          stop_time: c.stop_time ?? null,
          spend_cap: spendCap,
          budget_remaining: c.budget_remaining ? Number(c.budget_remaining) / 100 : null,
          account: actId,
          integration_id: integrationId,
          company_id: companyId,
          api_created_at: c.created_time ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id,company_id', ignoreDuplicates: false }
      )
      .select('id, external_id')
      .single();

    if (upserted) {
      campaignIdMap.set(c.id, upserted.id);
      stats.campaigns_synced++;
    }
  }

  // ===== 2. Sync insights (metrics) for last 30 days =====
  const insightsUrl =
    `${GRAPH_BASE}/${actId}/insights` +
    `?fields=campaign_id,campaign_name,adset_name,ad_name,date_start,impressions,clicks,spend,cpm,cpc,ctr,reach,frequency,unique_clicks,unique_ctr,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,actions,cost_per_action_type,website_purchase_roas` +
    `&date_preset=last_30d&time_increment=1&level=ad&limit=500&access_token=${token}`;

  const insightsResp = await fetch(insightsUrl);
  const insightsData = await insightsResp.json();

  if (!insightsData.error) {
    const insights: MetaInsight[] = insightsData.data ?? [];

    for (const ins of insights) {
      const conversasExtracted = extractConversasIniciadas(ins.actions);
      const custoExtracted = extractCustoConversa(ins.actions, ins.cost_per_action_type);

      const roas = ins.website_purchase_roas?.[0]?.value;

      // Dedup: remove metric antigo da mesma combinacao dia+campanha+adset+ad antes de inserir
      const metricDate = ins.date_start ?? new Date().toISOString().split('T')[0];
      let delQ = supabase.from('campaign_metrics')
        .delete()
        .eq('company_id', companyId)
        .eq('data', metricDate);
      delQ = ins.campaign_name ? delQ.eq('campanha', ins.campaign_name) : delQ.is('campanha', null);
      delQ = ins.adset_name ? delQ.eq('grupo_anuncios', ins.adset_name) : delQ.is('grupo_anuncios', null);
      delQ = ins.ad_name ? delQ.eq('anuncios', ins.ad_name) : delQ.is('anuncios', null);
      await delQ;

      await supabase.from('campaign_metrics').insert({
        data: metricDate,
        nome_conta: accountName,
        campanha: ins.campaign_name ?? null,
        grupo_anuncios: ins.adset_name ?? null,
        anuncios: ins.ad_name ?? null,
        impressoes: Number(ins.impressions) || 0,
        cliques: Number(ins.clicks) || 0,
        cpm: Number(ins.cpm) || 0,
        cpc: Number(ins.cpc) || 0,
        investimento: Number(ins.spend) || 0,
        reach: Number(ins.reach) || 0,
        frequency: Number(ins.frequency) || 0,
        unique_clicks: Number(ins.unique_clicks) || 0,
        unique_ctr: Number(ins.unique_ctr) || 0,
        quality_ranking: ins.quality_ranking ?? null,
        engagement_rate_ranking: ins.engagement_rate_ranking ?? null,
        conversion_rate_ranking: ins.conversion_rate_ranking ?? null,
        conversas_iniciadas: conversasExtracted,
        custo_conversa: custoExtracted ?? 0,
        website_purchase_roas: roas ? Number(roas) : 0,
        company_id: companyId,
        source: 'meta_api',
        sync_batch: new Date().toISOString(),
      });
      stats.metrics_synced++;
    }
  }

  // ===== 3. Sync ads + creatives =====
  const adsUrl =
    `${GRAPH_BASE}/${actId}/ads` +
    `?fields=id,name,status,campaign_id,adset_id,creative{id,name,title,body,image_url,thumbnail_url,video_id,call_to_action_type,object_type,effective_object_story_id}` +
    `&limit=100&access_token=${token}`;

  const adsResp = await fetch(adsUrl);
  const adsData = await adsResp.json();

  if (!adsData.error) {
    const ads: MetaAd[] = adsData.data ?? [];

    for (const ad of ads) {
      if (!ad.creative) continue;

      const internalCampaignId = ad.campaign_id ? campaignIdMap.get(ad.campaign_id) ?? null : null;
      const mediaType = ad.creative.video_id ? 'video' : ad.creative.image_url ? 'image' : 'unknown';

      // Fallback: se video sem thumbnail_url, busca a MAIOR thumbnail disponivel
      // do video. Meta retorna varias resolucoes — picamos a de maior area pra
      // evitar blur no card.
      let resolvedThumbnail = ad.creative.thumbnail_url ?? null;
      if (ad.creative.video_id) {
        try {
          const vidUrl = `${GRAPH_BASE}/${ad.creative.video_id}?fields=thumbnails{uri,width,height,is_preferred},picture&access_token=${token}`;
          const vidResp = await fetch(vidUrl);
          const vidData = await vidResp.json();
          if (!vidData.error) {
            type Thumb = { uri: string; width?: number; height?: number; is_preferred?: boolean };
            const thumbs: Thumb[] = vidData.thumbnails?.data ?? [];
            // Ordena por area decrescente, prefere is_preferred entre tamanhos iguais
            const sorted = [...thumbs].sort((a, b) => {
              const aArea = (a.width ?? 0) * (a.height ?? 0);
              const bArea = (b.width ?? 0) * (b.height ?? 0);
              if (bArea !== aArea) return bArea - aArea;
              return (b.is_preferred ? 1 : 0) - (a.is_preferred ? 1 : 0);
            });
            const best = sorted[0]?.uri ?? null;
            // Sobrescreve mesmo se thumbnail_url ja tinha valor — best e maior res
            resolvedThumbnail = best ?? resolvedThumbnail ?? vidData.picture ?? null;
          }
        } catch (err) {
          console.warn(`[sync] thumbnail fallback failed for ${ad.creative.video_id}:`, err);
        }
      }

      await supabase.from('creatives').upsert(
        {
          external_id: ad.creative.id,
          ad_external_id: ad.id,  // ad.id (parent do creative) — usado pra Ad Preview API
          name: ad.creative.name ?? ad.name,
          type: mediaType,
          image_url: ad.creative.image_url ?? null,
          thumbnail_url: resolvedThumbnail,
          video_id: ad.creative.video_id ?? null,
          effective_object_story_id: ad.creative.effective_object_story_id ?? null,
          headline: ad.creative.title ?? null,
          text: ad.creative.body ?? null,
          call_to_action: ad.creative.call_to_action_type ?? null,
          status: ad.status,
          campaign_id: internalCampaignId,
          company_id: companyId,
          platform: 'meta',
          detected_media_type: mediaType,
          ad_account_id: actId,  // ex: 'act_1234567890' — permite filtrar/cleanup por conta
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id,company_id', ignoreDuplicates: false }
      );
      stats.creatives_synced++;
    }
  }
}
