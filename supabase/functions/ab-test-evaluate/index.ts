// ab-test-evaluate — ab-testing (Sprint 7/8)
// Calcula vencedor entre 2 variantes a partir de campaign_metrics/adset_metrics.
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireTenant } from '../_shared/tenant-guard.ts';
import { jsonResponse } from '../_shared/meta-edits-helpers.ts';

const PayloadSchema = z.object({ test_id: z.string().uuid() });

const SAMPLE_MIN: Record<string, number> = {
  ctr: 100, // cliques minimo
  cpl: 30,  // leads
  roas: 30,
  conversions: 30,
  spend_efficiency: 30,
};

const DIFF_THRESHOLD_TIED = 0.10; // 10%

interface VariantMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

async function loadVariantMetrics(
  supabase: any,
  kind: string,
  externalId: string,
  since: string,
  companyId: string,
): Promise<VariantMetrics> {
  // campaign_metrics no projeto usa colunas PORTUGUES (legado importacao CSV/insights):
  //   data (timestamp), campanha (text), grupo_anuncios (text), anuncios (text),
  //   impressoes, cliques, investimento, conversas_iniciadas, website_purchase_roas
  // Nao tem FK por external_id. Resolvemos external_id -> entity name primeiro.
  const sums: VariantMetrics = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };

  let nameField: 'campanha' | 'grupo_anuncios' | 'anuncios' = 'campanha';
  let entityName: string | null = null;

  if (kind === 'campaign') {
    nameField = 'campanha';
    const { data } = await supabase
      .from('campaigns')
      .select('name')
      .eq('company_id', companyId)
      .eq('external_id', externalId)
      .maybeSingle();
    entityName = data?.name ?? null;
  } else if (kind === 'adset') {
    nameField = 'grupo_anuncios';
    const { data } = await supabase
      .from('adsets')
      .select('name')
      .eq('company_id', companyId)
      .eq('external_id', externalId)
      .maybeSingle();
    entityName = data?.name ?? null;
  } else {
    nameField = 'anuncios';
    // Ads-level: tentar campaign_publications.name como proxy
    const { data } = await supabase
      .from('campaign_publications')
      .select('name')
      .eq('company_id', companyId)
      .eq('meta_ad_id', externalId)
      .maybeSingle();
    entityName = data?.name ?? null;
  }

  if (!entityName) return sums; // sem rows possiveis

  const { data: rows } = await supabase
    .from('campaign_metrics')
    .select('impressoes, cliques, investimento, conversas_iniciadas, website_purchase_roas')
    .eq('company_id', companyId)
    .eq(nameField, entityName)
    .gte('data', since.slice(0, 10));

  if (rows && rows.length > 0) {
    for (const r of rows) {
      const impressoes = Number(r.impressoes ?? 0);
      const cliques = Number(r.cliques ?? 0);
      const investimento = Number(r.investimento ?? 0);
      const conversas = Number(r.conversas_iniciadas ?? 0);
      const roas = Number(r.website_purchase_roas ?? 0);
      sums.impressions += impressoes;
      sums.clicks += cliques;
      sums.spend += investimento;
      sums.conversions += conversas;
      // revenue derivado de ROAS * investimento (campaign_metrics nao tem coluna revenue direta)
      sums.revenue += roas * investimento;
    }
  }
  return sums;
}

function computeRate(criterion: string, m: VariantMetrics): number {
  switch (criterion) {
    case 'ctr':
      return m.impressions > 0 ? m.clicks / m.impressions : 0;
    case 'cpl':
      return m.conversions > 0 ? m.spend / m.conversions : Infinity;
    case 'roas':
      return m.spend > 0 ? m.revenue / m.spend : 0;
    case 'conversions':
      return m.conversions;
    case 'spend_efficiency':
      return m.spend > 0 ? m.conversions / m.spend : 0;
    default: return 0;
  }
}

function sampleSize(criterion: string, m: VariantMetrics): number {
  if (criterion === 'ctr') return m.clicks;
  return m.conversions;
}

function decideWinner(criterion: string, a: number, b: number): 'a' | 'b' | 'tied' {
  // Para CPL: menor e melhor. Outros: maior e melhor.
  const aBetter = criterion === 'cpl' ? a < b : a > b;
  const best = aBetter ? a : b;
  const worst = aBetter ? b : a;
  if (worst === 0 && best > 0) return aBetter ? 'a' : 'b';
  if (best === worst) return 'tied';
  const diff = Math.abs(best - worst) / worst;
  if (diff < DIFF_THRESHOLD_TIED) return 'tied';
  return aBetter ? 'a' : 'b';
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const tenant = await requireTenant(req, supabaseAdmin, { cors });
  if (!tenant.ok) return tenant.response;
  const { companyId } = tenant.value;

  let payload: z.infer<typeof PayloadSchema>;
  try {
    payload = PayloadSchema.parse(await req.json());
  } catch (e: any) {
    return jsonResponse({ error: 'invalid_payload', detail: e?.errors }, 400, cors);
  }

  const { data: test, error: te } = await supabaseAdmin
    .from('ab_tests')
    .select('*')
    .eq('id', payload.test_id)
    .maybeSingle();

  if (te || !test) return jsonResponse({ error: 'test_not_found' }, 404, cors);
  if (test.company_id !== companyId) return jsonResponse({ error: 'forbidden' }, 403, cors);

  const aMetrics = await loadVariantMetrics(supabaseAdmin, test.variant_a_kind, test.variant_a_external_id, test.started_at, companyId);
  const bMetrics = await loadVariantMetrics(supabaseAdmin, test.variant_b_kind, test.variant_b_external_id, test.started_at, companyId);

  const aRate = computeRate(test.criterion, aMetrics);
  const bRate = computeRate(test.criterion, bMetrics);
  const aSample = sampleSize(test.criterion, aMetrics);
  const bSample = sampleSize(test.criterion, bMetrics);
  const minSample = SAMPLE_MIN[test.criterion] ?? 30;
  const sufficient = aSample >= minSample && bSample >= minSample;

  let winner: 'a' | 'b' | 'tied' | 'inconclusive';
  if (!sufficient) {
    winner = 'inconclusive';
  } else {
    winner = decideWinner(test.criterion, aRate, bRate);
  }

  const summary = {
    criterion: test.criterion,
    variant_a: { metrics: aMetrics, rate: aRate, sample: aSample },
    variant_b: { metrics: bMetrics, rate: bRate, sample: bSample },
    sufficient_sample: sufficient,
    min_sample_required: minSample,
    diff_pct: bRate > 0 ? ((aRate - bRate) / bRate) * 100 : null,
    decided_at: new Date().toISOString(),
    notes: !sufficient
      ? `Aguardando amostra: A=${aSample}, B=${bSample}, min=${minSample}.`
      : winner === 'tied'
        ? 'Diferenca menor que 10% — empate tecnico.'
        : `Variant ${winner.toUpperCase()} venceu por ~${Math.abs(((aRate - bRate) / Math.min(aRate, bRate)) * 100).toFixed(1)}%.`,
  };

  await supabaseAdmin
    .from('ab_tests')
    .update({
      winner_variant: winner,
      evaluation_summary: summary,
      evaluated_at: new Date().toISOString(),
    })
    .eq('id', payload.test_id);

  return jsonResponse({ ok: true, test_id: payload.test_id, winner, summary }, 200, cors);
});
