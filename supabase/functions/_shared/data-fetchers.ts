import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Data fetchers — queries seguras para cada tool do Function Calling.
 * Todas retornam dados formatados em Markdown para o LLM.
 */

// Helper: calcular datas baseado em date_range
// Usa timezone America/Sao_Paulo por padrao (mercado-alvo pt-BR)
// campaign_metrics armazena 'data' como date-only (sem timezone)
function getDateRange(range: string): { start: string; end: string } {
  // Agora no timezone pt-BR (evita off-by-one em UTC vs BRT)
  const tzFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const nowLocalStr = tzFormat.format(new Date()); // YYYY-MM-DD
  const now = new Date(nowLocalStr + 'T12:00:00Z'); // noon UTC, safe pra math de dias
  const end = nowLocalStr;
  let start: Date;

  switch (range) {
    case 'last_7_days':
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case 'last_14_days':
      start = new Date(now.getTime() - 14 * 86400000);
      break;
    case 'last_30_days':
    case 'this_month':
      start = new Date(now.getTime() - 30 * 86400000);
      break;
    case 'previous_7_days':
      start = new Date(now.getTime() - 14 * 86400000);
      return { start: start.toISOString().split('T')[0], end: new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0] };
    case 'previous_14_days':
      start = new Date(now.getTime() - 28 * 86400000);
      return { start: start.toISOString().split('T')[0], end: new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0] };
    case 'previous_30_days':
      start = new Date(now.getTime() - 60 * 86400000);
      return { start: start.toISOString().split('T')[0], end: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0] };
    default:
      start = new Date(now.getTime() - 7 * 86400000);
  }

  return { start: start.toISOString().split('T')[0], end };
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return `R$ ${val.toFixed(2)}`;
}

function formatNumber(val: number | null): string {
  if (val === null || val === undefined) return '—';
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toString();
}

// ========== TOOL IMPLEMENTATIONS ==========

export async function getCampaignsSummary(
  supabase: SupabaseClient,
  companyId: string,
  args: { status?: string; date_range: string; limit?: number }
): Promise<string> {
  const { start, end } = getDateRange(args.date_range);
  const limit = args.limit ?? 10;

  // Buscar métricas agregadas por campanha
  const { data, error } = await supabase
    .from('campaign_metrics')
    .select('campanha, impressoes, cliques, cpc, cpm, investimento, conversas_iniciadas, custo_conversa, website_purchase_roas, unique_ctr')
    .eq('company_id', companyId)
    .gte('data', start)
    .lte('data', end)
    .order('investimento', { ascending: false });

  if (error || !data || data.length === 0) {
    return `Nenhuma metrica encontrada para o periodo ${args.date_range}. Verifique se as campanhas estao sincronizadas.`;
  }

  // Agregar por campanha
  const bycamp = new Map<string, { impressoes: number; cliques: number; investimento: number; conversas: number; roas: number; count: number }>();
  for (const row of data) {
    const name = row.campanha ?? 'Sem nome';
    const curr = bycamp.get(name) ?? { impressoes: 0, cliques: 0, investimento: 0, conversas: 0, roas: 0, count: 0 };
    curr.impressoes += row.impressoes ?? 0;
    curr.cliques += row.cliques ?? 0;
    curr.investimento += Number(row.investimento) || 0;
    curr.conversas += row.conversas_iniciadas ?? 0;
    curr.roas += Number(row.website_purchase_roas) || 0;
    curr.count += 1;
    bycamp.set(name, curr);
  }

  // Formatar como markdown
  const sorted = [...bycamp.entries()].sort((a, b) => b[1].investimento - a[1].investimento).slice(0, limit);

  let totalInvest = 0, totalImpr = 0, totalClicks = 0, totalConversas = 0;
  let md = `| Campanha | Investimento | Impressoes | Cliques | CTR | CPC | Conversas | ROAS |\n`;
  md += `|----------|-------------|------------|---------|-----|-----|-----------|------|\n`;

  for (const [name, m] of sorted) {
    const ctr = m.impressoes > 0 ? ((m.cliques / m.impressoes) * 100).toFixed(2) + '%' : '—';
    const cpc = m.cliques > 0 ? formatCurrency(m.investimento / m.cliques) : '—';
    const roas = m.count > 0 ? (m.roas / m.count).toFixed(2) + 'x' : '—';
    md += `| ${name.substring(0, 30)} | ${formatCurrency(m.investimento)} | ${formatNumber(m.impressoes)} | ${formatNumber(m.cliques)} | ${ctr} | ${cpc} | ${m.conversas} | ${roas} |\n`;
    totalInvest += m.investimento;
    totalImpr += m.impressoes;
    totalClicks += m.cliques;
    totalConversas += m.conversas;
  }

  md += `\n**Resumo (${args.date_range}):** ${sorted.length} campanhas, investimento total ${formatCurrency(totalInvest)}, ${formatNumber(totalImpr)} impressoes, ${formatNumber(totalClicks)} cliques, ${totalConversas} conversas`;
  if (totalClicks > 0) md += `, CPC medio ${formatCurrency(totalInvest / totalClicks)}`;
  if (totalImpr > 0) md += `, CTR medio ${((totalClicks / totalImpr) * 100).toFixed(2)}%`;

  return md;
}

export async function getCampaignDetails(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string; date_range?: string }
): Promise<string> {
  // Input validation: evita DOS com wildcards grandes + escape % _ (specials do LIKE)
  const rawName = (args.campaign_name ?? '').slice(0, 100);
  const escapedName = rawName.replace(/[\\%_]/g, '\\$&');
  if (escapedName.length === 0) return 'Nome da campanha obrigatorio.';
  const { start, end } = getDateRange(args.date_range ?? 'last_7_days');

  const { data, error } = await supabase
    .from('campaign_metrics')
    .select('data, campanha, grupo_anuncios, anuncios, impressoes, cliques, cpc, cpm, investimento, conversas_iniciadas, custo_conversa, website_purchase_roas, quality_ranking, engagement_rate_ranking')
    .eq('company_id', companyId)
    .ilike('campanha', `%${escapedName}%`)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false });

  if (error || !data || data.length === 0) {
    return `Nenhuma campanha encontrada com nome "${args.campaign_name}" no periodo.`;
  }

  const name = data[0].campanha;
  let totalImpr = 0, totalClicks = 0, totalInvest = 0, totalConversas = 0;
  let md = `## Detalhes: ${name}\n\n`;
  md += `| Data | Impressoes | Cliques | CPC | Investimento | Conversas | ROAS |\n`;
  md += `|------|------------|---------|-----|-------------|-----------|------|\n`;

  for (const row of data.slice(0, 14)) {
    const date = row.data ? new Date(row.data).toLocaleDateString('pt-BR') : '—';
    md += `| ${date} | ${formatNumber(row.impressoes)} | ${formatNumber(row.cliques)} | ${formatCurrency(Number(row.cpc))} | ${formatCurrency(Number(row.investimento))} | ${row.conversas_iniciadas ?? 0} | ${row.website_purchase_roas ? Number(row.website_purchase_roas).toFixed(2) + 'x' : '—'} |\n`;
    totalImpr += row.impressoes ?? 0;
    totalClicks += row.cliques ?? 0;
    totalInvest += Number(row.investimento) || 0;
    totalConversas += row.conversas_iniciadas ?? 0;
  }

  md += `\n**Total:** ${formatNumber(totalImpr)} impressoes, ${formatNumber(totalClicks)} cliques, ${formatCurrency(totalInvest)} investido, ${totalConversas} conversas`;
  if (data[0].quality_ranking) md += `\nQuality Ranking: ${data[0].quality_ranking}`;
  if (data[0].engagement_rate_ranking) md += ` | Engagement: ${data[0].engagement_rate_ranking}`;

  return md;
}

export async function getMetricsComparison(
  supabase: SupabaseClient,
  companyId: string,
  args: { period_a: string; period_b: string; campaign_name?: string }
): Promise<string> {
  const rangeA = getDateRange(args.period_a);
  const rangeB = getDateRange(args.period_b);

  let queryA = supabase.from('campaign_metrics').select('impressoes, cliques, investimento, conversas_iniciadas, website_purchase_roas').eq('company_id', companyId).gte('data', rangeA.start).lte('data', rangeA.end);
  let queryB = supabase.from('campaign_metrics').select('impressoes, cliques, investimento, conversas_iniciadas, website_purchase_roas').eq('company_id', companyId).gte('data', rangeB.start).lte('data', rangeB.end);

  if (args.campaign_name) {
    queryA = queryA.ilike('campanha', `%${args.campaign_name}%`);
    queryB = queryB.ilike('campanha', `%${args.campaign_name}%`);
  }

  const [{ data: dataA }, { data: dataB }] = await Promise.all([queryA, queryB]);

  const sumA = aggregate(dataA ?? []);
  const sumB = aggregate(dataB ?? []);

  const pct = (a: number, b: number) => {
    if (b === 0) return '—';
    const diff = ((a - b) / b) * 100;
    return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}%`;
  };

  let md = `## Comparacao: ${args.period_a} vs ${args.period_b}\n`;
  if (args.campaign_name) md += `Campanha: ${args.campaign_name}\n`;
  md += `\n| Metrica | Periodo Atual | Periodo Anterior | Variacao |\n`;
  md += `|---------|--------------|-----------------|----------|\n`;
  md += `| Impressoes | ${formatNumber(sumA.impressoes)} | ${formatNumber(sumB.impressoes)} | ${pct(sumA.impressoes, sumB.impressoes)} |\n`;
  md += `| Cliques | ${formatNumber(sumA.cliques)} | ${formatNumber(sumB.cliques)} | ${pct(sumA.cliques, sumB.cliques)} |\n`;
  md += `| Investimento | ${formatCurrency(sumA.investimento)} | ${formatCurrency(sumB.investimento)} | ${pct(sumA.investimento, sumB.investimento)} |\n`;
  md += `| Conversas | ${sumA.conversas} | ${sumB.conversas} | ${pct(sumA.conversas, sumB.conversas)} |\n`;

  const ctrA = sumA.impressoes > 0 ? (sumA.cliques / sumA.impressoes * 100) : 0;
  const ctrB = sumB.impressoes > 0 ? (sumB.cliques / sumB.impressoes * 100) : 0;
  md += `| CTR | ${ctrA.toFixed(2)}% | ${ctrB.toFixed(2)}% | ${pct(ctrA, ctrB)} |\n`;

  const cpcA = sumA.cliques > 0 ? sumA.investimento / sumA.cliques : 0;
  const cpcB = sumB.cliques > 0 ? sumB.investimento / sumB.cliques : 0;
  md += `| CPC | ${formatCurrency(cpcA)} | ${formatCurrency(cpcB)} | ${pct(cpcA, cpcB)} |\n`;

  return md;
}

function aggregate(rows: Array<{ impressoes: number | null; cliques: number | null; investimento: number | null; conversas_iniciadas: number | null; website_purchase_roas: number | null }>) {
  let impressoes = 0, cliques = 0, investimento = 0, conversas = 0;
  for (const r of rows) {
    impressoes += r.impressoes ?? 0;
    cliques += r.cliques ?? 0;
    investimento += Number(r.investimento) || 0;
    conversas += r.conversas_iniciadas ?? 0;
  }
  return { impressoes, cliques, investimento, conversas };
}

export async function getTopPerformers(
  supabase: SupabaseClient,
  companyId: string,
  args: { metric: string; order: string; limit?: number; date_range?: string }
): Promise<string> {
  const { start, end } = getDateRange(args.date_range ?? 'last_7_days');
  const limit = args.limit ?? 5;

  const { data, error } = await supabase
    .from('campaign_metrics')
    .select('campanha, impressoes, cliques, investimento, conversas_iniciadas, cpc, cpm, custo_conversa, website_purchase_roas, unique_ctr')
    .eq('company_id', companyId)
    .gte('data', start)
    .lte('data', end);

  if (error || !data || data.length === 0) {
    return 'Nenhuma metrica encontrada para o periodo.';
  }

  // Agregar por campanha
  const bycamp = new Map<string, { total: number; count: number; impressoes: number; cliques: number; investimento: number }>();
  for (const row of data) {
    const name = row.campanha ?? 'Sem nome';
    const curr = bycamp.get(name) ?? { total: 0, count: 0, impressoes: 0, cliques: 0, investimento: 0 };
    curr.total += Number((row as Record<string, unknown>)[args.metric]) || 0;
    curr.count += 1;
    curr.impressoes += row.impressoes ?? 0;
    curr.cliques += row.cliques ?? 0;
    curr.investimento += Number(row.investimento) || 0;
    bycamp.set(name, curr);
  }

  const ascending = args.order === 'worst';
  const sorted = [...bycamp.entries()].sort((a, b) => ascending ? a[1].total - b[1].total : b[1].total - a[1].total).slice(0, limit);

  let md = `## ${args.order === 'best' ? 'Melhores' : 'Piores'} por ${args.metric}\n\n`;
  md += `| # | Campanha | ${args.metric} | Investimento | Impressoes |\n`;
  md += `|---|----------|${'-'.repeat(args.metric.length + 2)}|-------------|------------|\n`;

  sorted.forEach(([name, m], i) => {
    const val = ['investimento', 'cpc', 'cpm', 'custo_conversa'].includes(args.metric)
      ? formatCurrency(m.total / (m.count || 1))
      : formatNumber(m.total);
    md += `| ${i + 1} | ${name.substring(0, 30)} | ${val} | ${formatCurrency(m.investimento)} | ${formatNumber(m.impressoes)} |\n`;
  });

  return md;
}

export async function getDailyMetrics(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name?: string; days?: number }
): Promise<string> {
  const days = Math.min(args.days ?? 7, 30);
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  let query = supabase
    .from('campaign_metrics')
    .select('data, impressoes, cliques, investimento, conversas_iniciadas, website_purchase_roas')
    .eq('company_id', companyId)
    .gte('data', start)
    .order('data', { ascending: true });

  if (args.campaign_name) {
    query = query.ilike('campanha', `%${args.campaign_name}%`);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return `Nenhuma metrica diaria encontrada para os ultimos ${days} dias.`;
  }

  // Agregar por dia
  const byDay = new Map<string, { impressoes: number; cliques: number; investimento: number; conversas: number }>();
  for (const row of data) {
    const day = row.data ? new Date(row.data).toLocaleDateString('pt-BR') : 'Sem data';
    const curr = byDay.get(day) ?? { impressoes: 0, cliques: 0, investimento: 0, conversas: 0 };
    curr.impressoes += row.impressoes ?? 0;
    curr.cliques += row.cliques ?? 0;
    curr.investimento += Number(row.investimento) || 0;
    curr.conversas += row.conversas_iniciadas ?? 0;
    byDay.set(day, curr);
  }

  let md = `## Metricas Diarias (ultimos ${days} dias)\n`;
  if (args.campaign_name) md += `Campanha: ${args.campaign_name}\n`;
  md += `\n| Data | Impressoes | Cliques | CTR | Investimento | Conversas |\n`;
  md += `|------|------------|---------|-----|-------------|----------|\n`;

  for (const [day, m] of byDay) {
    const ctr = m.impressoes > 0 ? ((m.cliques / m.impressoes) * 100).toFixed(2) + '%' : '—';
    md += `| ${day} | ${formatNumber(m.impressoes)} | ${formatNumber(m.cliques)} | ${ctr} | ${formatCurrency(m.investimento)} | ${m.conversas} |\n`;
  }

  return md;
}

export async function getAccountInfo(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('facebook_user_name, account_name, business_name, status, token_expires_at, last_sync')
    .eq('company_id', companyId)
    .eq('platform', 'meta')
    .single();

  if (!integration) {
    return 'Nenhuma conta Meta conectada. Va em Integracoes para conectar sua conta.';
  }

  const { data: accounts } = await supabase
    .from('meta_ad_accounts')
    .select('account_name, account_id, account_status, currency')
    .eq('company_id', companyId);

  let md = `## Conta Meta Conectada\n\n`;
  md += `- **Usuario:** ${integration.facebook_user_name ?? '—'}\n`;
  md += `- **Business:** ${integration.business_name ?? '—'}\n`;
  md += `- **Status:** ${integration.status ?? '—'}\n`;
  if (integration.token_expires_at) {
    const daysLeft = Math.ceil((new Date(integration.token_expires_at).getTime() - Date.now()) / 86400000);
    md += `- **Token expira em:** ${daysLeft} dias\n`;
  }
  if (integration.last_sync) {
    md += `- **Ultima sync:** ${new Date(integration.last_sync).toLocaleString('pt-BR')}\n`;
  }

  if (accounts && accounts.length > 0) {
    md += `\n### Ad Accounts (${accounts.length})\n`;
    for (const acc of accounts) {
      md += `- ${acc.account_name ?? acc.account_id} (${acc.currency ?? '—'}) — Status: ${acc.account_status ?? '—'}\n`;
    }
  }

  return md;
}

// ========== FURY TOOLS ==========

export async function getFuryActions(
  supabase: SupabaseClient,
  companyId: string,
  args: { status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(args.limit ?? 10, 50);
  let query = supabase
    .from('fury_actions')
    .select('campaign_name, rule_key, rule_display_name, action_type, status, metric_name, metric_value, threshold_value, revert_before, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (args.status && args.status !== 'all') query = query.eq('status', args.status);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return 'Nenhuma acao do FURY encontrada.';

  let md = `## Acoes do FURY\n\n| Data | Campanha | Regra | Acao | Status | Metrica | Valor | Threshold |\n|------|----------|-------|------|--------|---------|-------|----------|\n`;
  for (const a of data) {
    const date = new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    md += `| ${date} | ${(a.campaign_name ?? '—').substring(0, 25)} | ${a.rule_display_name ?? a.rule_key} | ${a.action_type} | ${a.status} | ${a.metric_name ?? '—'} | ${a.metric_value ?? '—'} | ${a.threshold_value ?? '—'} |\n`;
  }
  return md;
}

export async function getFuryEvaluations(
  supabase: SupabaseClient,
  companyId: string,
  args: { health_filter?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(args.limit ?? 10, 50);
  let query = supabase
    .from('fury_evaluations')
    .select('campaign_name, avg_ctr, avg_cpc, avg_frequency, total_spend, daily_cpa, trend_direction, rules_triggered, overall_health, evaluated_at')
    .eq('company_id', companyId)
    .order('evaluated_at', { ascending: false })
    .limit(limit);
  if (args.health_filter && args.health_filter !== 'all') query = query.eq('overall_health', args.health_filter);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return 'Nenhuma avaliacao FURY encontrada.';

  let md = `## Avaliacoes FURY\n\n| Campanha | Saude | CTR | CPC | CPA | Freq | Spend 7d | Tendencia | Regras |\n|----------|-------|-----|-----|-----|------|----------|-----------|--------|\n`;
  for (const e of data) {
    const rules = (e.rules_triggered as string[] ?? []).join(', ') || '—';
    md += `| ${(e.campaign_name ?? '—').substring(0, 25)} | ${e.overall_health} | ${Number(e.avg_ctr).toFixed(2)}% | R$${Number(e.avg_cpc).toFixed(2)} | R$${Number(e.daily_cpa).toFixed(2)} | ${Number(e.avg_frequency).toFixed(1)} | R$${Number(e.total_spend).toFixed(2)} | ${e.trend_direction} | ${rules} |\n`;
  }
  return md;
}

export async function getComplianceStatus(
  supabase: SupabaseClient,
  companyId: string,
  args: { health_filter?: string; include_violations?: boolean; limit?: number }
): Promise<string> {
  const limit = Math.min(args.limit ?? 10, 50);
  let query = supabase
    .from('compliance_scores')
    .select('id, creative_id, external_ad_id, copy_score, image_score, final_score, health_status')
    .eq('company_id', companyId)
    .order('scanned_at', { ascending: false })
    .limit(limit);
  if (args.health_filter && args.health_filter !== 'all') query = query.eq('health_status', args.health_filter);

  const { data: scores, error } = await query;
  if (error || !scores || scores.length === 0) return 'Nenhum anuncio analisado pelo compliance.';

  const cIds = [...new Set(scores.map((s) => s.creative_id).filter(Boolean))];
  const { data: creatives } = await supabase.from('creatives').select('id, name, headline').in('id', cIds);
  const nameMap = new Map((creatives ?? []).map((c: { id: string; name: string | null; headline: string | null }) => [c.id, c.name ?? c.headline ?? '—']));

  let md = `## Compliance (${scores.length} anuncios)\n\n| Anuncio | Score | Copy | Visual | Status |\n|---------|-------|------|--------|--------|\n`;
  for (const s of scores) {
    md += `| ${(nameMap.get(s.creative_id) ?? s.external_ad_id ?? '—').substring(0, 30)} | **${s.final_score}**/100 | ${s.copy_score ?? '—'} | ${s.image_score ?? '—'} | ${s.health_status} |\n`;
  }

  if (args.include_violations) {
    const problemIds = scores.filter((s) => s.health_status !== 'healthy').slice(0, 5).map((s) => s.id);
    if (problemIds.length > 0) {
      const { data: viols } = await supabase.from('compliance_violations').select('severity, description, evidence').in('score_id', problemIds).limit(20);
      if (viols && viols.length > 0) {
        md += `\n### Violacoes\n`;
        for (const v of viols) md += `- **[${(v.severity as string).toUpperCase()}]** ${v.description}${v.evidence ? ` — _"${v.evidence}"_` : ''}\n`;
      }
    }
  }
  return md;
}

// ========== ACTION TOOLS ==========

const GRAPH_VERSION_ACTIONS = 'v22.0';

// ---------- PROPOSE actions (HITL — Sprint A1) ----------
//
// Em vez de executar Meta API direto, criam um row em `approvals` com status='pending'.
// O usuario aprova/rejeita via ApprovalsView, que dispara a Edge Function `approval-action`.
// approval-action eh quem chama Meta API de fato.

async function findOneCampaignByName(
  supabase: SupabaseClient,
  companyId: string,
  name: string
): Promise<{ id: string; external_id: string | null; name: string; status: string } | string> {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, external_id, name, status')
    .eq('company_id', companyId)
    .ilike('name', `%${name}%`);

  if (!campaigns || campaigns.length === 0) {
    return `Nenhuma campanha encontrada com nome "${name}".`;
  }
  if (campaigns.length > 1) {
    return `Encontrei ${campaigns.length} campanhas. Seja mais especifico:\n${campaigns.map((c) => `- ${c.name} (${c.status})`).join('\n')}`;
  }
  return campaigns[0];
}

// ============================================================
// addProhibition — insere em compliance_rules (canonica desde 2026-04-28)
// Trigger sync_rule_to_prohibition_trigger espelha em company_prohibitions
// pra UI legada (Cerebro > Identidade > Step 6) continuar funcionando.
// ============================================================
export type ComplianceActionCapture = {
  prohibition?: { value: string; category: 'word' | 'topic' | 'visual' };
  rescan?: { scanned: number; violations: number; taken_down: number };
};

export async function addProhibition(
  supabase: SupabaseClient,
  companyId: string,
  args: { category?: 'word' | 'topic' | 'visual'; value?: string },
  capture?: { current: ComplianceActionCapture | null },
): Promise<string> {
  const category = args.category;
  const value = args.value?.trim().slice(0, 200);
  if (!category || !value) {
    return 'Forneca category (word/topic/visual) e value (texto).';
  }
  if (!['word', 'topic', 'visual'].includes(category)) {
    return `Categoria invalida: "${category}". Use word, topic ou visual.`;
  }
  // Tabela canonica unificada (compliance_rules); trigger sincroniza company_prohibitions
  const ruleType = category === 'visual' ? 'custom' : 'blacklist_term';
  const { error } = await supabase
    .from('compliance_rules')
    .insert({
      company_id: companyId,
      rule_type: ruleType,
      value,
      severity: 'warning',
      source: 'user',
      is_active: true,
      category,
    });
  if (error) {
    return `Falha ao adicionar proibicao: ${error.message}`;
  }
  if (capture) {
    capture.current = { ...(capture.current ?? {}), prohibition: { value, category } };
  }
  return `Proibicao "${value}" adicionada (categoria ${category}). Aparece em **Compliance** e em **Cerebro do FURY → Identidade → "O que NAO usar"** (mesma fonte). De agora em diante novos criativos com isso sao bloqueados. Vou rodar rescan_compliance pra detectar criativos antigos que agora violam.`;
}

// ============================================================
// rescanCompliance — invoca compliance-scan via fetch
// ============================================================
export async function rescanCompliance(
  authHeader: string,
  args: { mode?: 'active_only' | 'all' },
  capture?: { current: ComplianceActionCapture | null },
): Promise<string> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const mode = args.mode ?? 'active_only';
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/compliance-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ mode }),
    });
    const body = await resp.text();
    if (!resp.ok) {
      return `Falha no rescan compliance (HTTP ${resp.status}): ${body.slice(0, 300)}`;
    }
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(body); } catch { /* keep empty */ }
    const stats = json.stats as Record<string, number> | undefined;
    const parts: string[] = ['Rescan compliance concluido.'];
    if (stats) {
      if (typeof stats.scanned === 'number') parts.push(`- Analisados: ${stats.scanned}`);
      if (typeof stats.violations_found === 'number') parts.push(`- Violacoes: ${stats.violations_found}`);
      if (typeof stats.taken_down === 'number') parts.push(`- Pausados automaticamente: ${stats.taken_down}`);
    }
    parts.push('Veja detalhes em Compliance ou peca um get_compliance_status.');
    if (capture) {
      capture.current = {
        ...(capture.current ?? {}),
        rescan: {
          scanned: Number(stats?.scanned ?? 0),
          violations: Number(stats?.violations_found ?? 0),
          taken_down: Number(stats?.taken_down ?? 0),
        },
      };
    }
    return parts.join('\n');
  } catch (err) {
    return `Erro ao invocar compliance-scan: ${(err as Error).message}`;
  }
}

// ============================================================
// compareCreatives — analise pura de 2+ criativos por id ou nome
// ============================================================
export async function compareCreatives(
  supabase: SupabaseClient,
  companyId: string,
  args: { creative_ids?: string[]; creative_names?: string[] },
): Promise<string> {
  const ids = args.creative_ids ?? [];
  const names = args.creative_names ?? [];
  if (ids.length === 0 && names.length === 0) {
    return 'Forneca pelo menos 2 criativos via creative_ids ou creative_names.';
  }

  type Row = {
    id: string;
    title: string | null;
    concept: string;
    format: string;
    model_used: string;
    status: string;
    cost_usd: number;
    is_near_duplicate: boolean;
    pipeline_applied_rules: unknown;
    created_at: string;
  };

  // Junta query por id e por nome
  const found: Row[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('creatives_generated')
      .select('id, title, concept, format, model_used, status, cost_usd, is_near_duplicate, pipeline_applied_rules, created_at')
      .eq('company_id', companyId)
      .in('id', ids);
    if (data) found.push(...(data as Row[]));
  }
  if (names.length > 0) {
    for (const name of names) {
      const { data } = await supabase
        .from('creatives_generated')
        .select('id, title, concept, format, model_used, status, cost_usd, is_near_duplicate, pipeline_applied_rules, created_at')
        .eq('company_id', companyId)
        .ilike('title', `%${name}%`)
        .limit(3);
      if (data) found.push(...(data as Row[]));
    }
  }

  // Dedup por id
  const unique = Array.from(new Map(found.map((r) => [r.id, r])).values());
  if (unique.length < 2) {
    return `Encontrei ${unique.length} criativo(s). Preciso de pelo menos 2 pra comparar.`;
  }

  const lines: string[] = ['## Comparacao de criativos', ''];
  lines.push('| # | Titulo | Conceito | Formato | Modelo | Status | Custo | Pipeline | Criado |');
  lines.push('|---|--------|----------|---------|--------|--------|-------|----------|--------|');
  unique.slice(0, 4).forEach((r, i) => {
    const title = (r.title ?? r.concept).slice(0, 40);
    const concept = r.concept.slice(0, 50);
    const pipeline = Array.isArray(r.pipeline_applied_rules) ? `${r.pipeline_applied_rules.length} regras` : '—';
    const created = new Date(r.created_at).toLocaleDateString('pt-BR');
    lines.push(`| ${i + 1} | ${title} | ${concept} | ${r.format} | ${r.model_used} | ${r.status} | $${r.cost_usd.toFixed(4)} | ${pipeline} | ${created} |`);
  });

  // Heuristica leve: pHash similarity (grupo de near_duplicates)
  const dupes = unique.filter((r) => r.is_near_duplicate);
  if (dupes.length > 0) {
    lines.push('');
    lines.push(`> Atencao: ${dupes.length} desses criativos foram marcados como near-duplicates (visualmente similares a anteriores).`);
  }

  // Status breakdown
  const approved = unique.filter((r) => r.status === 'approved' || r.status === 'published').length;
  const generated = unique.filter((r) => r.status === 'generated').length;
  const discarded = unique.filter((r) => r.status === 'discarded').length;
  lines.push('');
  lines.push(`Status: ${approved} aprovado(s), ${generated} pendente(s), ${discarded} descartado(s).`);

  return lines.join('\n');
}

// ============================================================
// proposePauseAd / proposeReactivateAd — controle granular
// ============================================================
async function findOneAdByName(
  supabase: SupabaseClient,
  companyId: string,
  name: string,
): Promise<{ id: string; name: string; ad_external_id: string | null; effective_status: string | null } | string> {
  const { data } = await supabase
    .from('creatives')
    .select('id, name, ad_external_id, effective_status')
    .eq('company_id', companyId)
    .ilike('name', `%${name}%`)
    .limit(5);
  const rows = (data ?? []) as Array<{ id: string; name: string; ad_external_id: string | null; effective_status: string | null }>;
  if (rows.length === 0) return `Nenhum anuncio encontrado com nome contendo "${name}".`;
  if (rows.length > 1) {
    return `Encontrei ${rows.length} anuncios com "${name}": ${rows.map((r) => r.name).slice(0, 5).join(', ')}. Seja mais especifico.`;
  }
  return rows[0];
}

export async function proposePauseAd(
  supabase: SupabaseClient,
  companyId: string,
  args: { ad_name: string },
  conversationId: string | null,
): Promise<string> {
  const result = await findOneAdByName(supabase, companyId, args.ad_name);
  if (typeof result === 'string') return result;
  if (result.effective_status === 'PAUSED' || result.effective_status === 'ADSET_PAUSED' || result.effective_status === 'CAMPAIGN_PAUSED') {
    return `"${result.name}" ja esta pausado (${result.effective_status}).`;
  }
  if (!result.ad_external_id) {
    return `"${result.name}" sem ID externo Meta — nao da pra pausar via API.`;
  }

  const human_summary = `Pausar anuncio "${result.name}"`;
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      action_type: 'pause_ad',
      payload: { ad_id: result.id, ad_external_id: result.ad_external_id, ad_name: result.name },
      human_summary,
    })
    .select('id')
    .single();
  if (error || !approval) return `Falha ao criar aprovacao: ${error?.message ?? 'unknown'}`;
  return `Solicitacao criada (ID: ${approval.id}).\n\n**Acao proposta:** ${human_summary}\n\nO usuario precisa aprovar via painel de aprovacoes em ate 5 minutos.`;
}

export async function proposeReactivateAd(
  supabase: SupabaseClient,
  companyId: string,
  args: { ad_name: string },
  conversationId: string | null,
): Promise<string> {
  const result = await findOneAdByName(supabase, companyId, args.ad_name);
  if (typeof result === 'string') return result;
  if (result.effective_status === 'ACTIVE') return `"${result.name}" ja esta ativo.`;
  if (!result.ad_external_id) return `"${result.name}" sem ID externo Meta — nao da pra reativar via API.`;

  const human_summary = `Reativar anuncio "${result.name}"`;
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      action_type: 'reactivate_ad',
      payload: { ad_id: result.id, ad_external_id: result.ad_external_id, ad_name: result.name },
      human_summary,
    })
    .select('id')
    .single();
  if (error || !approval) return `Falha ao criar aprovacao: ${error?.message ?? 'unknown'}`;
  return `Solicitacao criada (ID: ${approval.id}).\n\n**Acao proposta:** ${human_summary}\n\nO usuario precisa aprovar via painel de aprovacoes em ate 5 minutos.`;
}

export async function proposePauseCampaign(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string },
  conversationId: string | null
): Promise<string> {
  const result = await findOneCampaignByName(supabase, companyId, args.campaign_name);
  if (typeof result === 'string') return result;

  if (result.status === 'PAUSED') return `"${result.name}" ja esta pausada.`;
  if (!result.external_id) return `"${result.name}" sem ID externo Meta — nao da pra pausar via API.`;

  const human_summary = `Pausar campanha "${result.name}"`;
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      action_type: 'pause_campaign',
      payload: {
        campaign_id: result.id,
        campaign_external_id: result.external_id,
        campaign_name: result.name,
      },
      human_summary,
    })
    .select('id')
    .single();

  if (error || !approval) {
    console.error('[propose] failed to insert approval:', error);
    return `Falha ao criar solicitacao de aprovacao: ${error?.message ?? 'unknown'}`;
  }

  return `Solicitacao de aprovacao criada (ID: ${approval.id}).\n\n**Acao proposta:** ${human_summary}\n\nO usuario precisa aprovar via painel de aprovacoes nos proximos 5 minutos para que a acao seja executada.`;
}

export async function proposeReactivateCampaign(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string },
  conversationId: string | null
): Promise<string> {
  const result = await findOneCampaignByName(supabase, companyId, args.campaign_name);
  if (typeof result === 'string') return result;

  if (result.status === 'ACTIVE') return `"${result.name}" ja esta ativa.`;
  if (!result.external_id) return `"${result.name}" sem ID externo Meta — nao da pra reativar via API.`;

  const human_summary = `Reativar campanha "${result.name}"`;
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      action_type: 'reactivate_campaign',
      payload: {
        campaign_id: result.id,
        campaign_external_id: result.external_id,
        campaign_name: result.name,
      },
      human_summary,
    })
    .select('id')
    .single();

  if (error || !approval) {
    console.error('[propose] failed to insert approval:', error);
    return `Falha ao criar solicitacao de aprovacao: ${error?.message ?? 'unknown'}`;
  }

  return `Solicitacao de aprovacao criada (ID: ${approval.id}).\n\n**Acao proposta:** ${human_summary}\n\nO usuario precisa aprovar via painel de aprovacoes nos proximos 5 minutos para que a acao seja executada.`;
}

export async function proposeUpdateBudget(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string; daily_budget_brl: number },
  conversationId: string | null
): Promise<string> {
  if (typeof args.daily_budget_brl !== 'number' || args.daily_budget_brl <= 0) {
    return `Valor de budget invalido: ${args.daily_budget_brl}. Deve ser numero positivo em BRL.`;
  }

  const result = await findOneCampaignByName(supabase, companyId, args.campaign_name);
  if (typeof result === 'string') return result;
  if (!result.external_id) return `"${result.name}" sem ID externo Meta.`;

  const cents = Math.round(args.daily_budget_brl * 100);
  const human_summary = `Alterar budget diario de "${result.name}" para R$ ${args.daily_budget_brl.toFixed(2)}`;

  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      action_type: 'update_budget',
      payload: {
        campaign_id: result.id,
        campaign_external_id: result.external_id,
        campaign_name: result.name,
        daily_budget_cents: cents,
      },
      human_summary,
    })
    .select('id')
    .single();

  if (error || !approval) {
    console.error('[propose] failed to insert approval:', error);
    return `Falha ao criar solicitacao de aprovacao: ${error?.message ?? 'unknown'}`;
  }

  return `Solicitacao de aprovacao criada (ID: ${approval.id}).\n\n**Acao proposta:** ${human_summary}\n\nO usuario precisa aprovar via painel de aprovacoes nos proximos 5 minutos.`;
}

// ---------- B2: PROPOSE PLAN (multi-step batch) ----------

interface PlanStepInput {
  action_type: 'pause_campaign' | 'reactivate_campaign' | 'update_budget';
  campaign_name: string;
  daily_budget_brl?: number;
}

export async function proposePlan(
  supabase: SupabaseClient,
  companyId: string,
  args: { steps: PlanStepInput[]; summary?: string; rationale?: string },
  conversationId: string | null
): Promise<string> {
  const steps = Array.isArray(args.steps) ? args.steps : [];
  if (steps.length < 2) {
    return 'propose_plan requer ao menos 2 acoes. Para uma unica acao, use pause_campaign / reactivate_campaign / update_budget direto.';
  }
  if (steps.length > 20) {
    return 'Plano com mais de 20 passos rejeitado por seguranca.';
  }

  // Resolver cada passo: encontrar campanha + montar payload
  const resolved: Array<{
    action_type: string;
    payload: Record<string, unknown>;
    human_summary: string;
  }> = [];
  const errors: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const found = await findOneCampaignByName(supabase, companyId, step.campaign_name);
    if (typeof found === 'string') {
      errors.push(`Passo ${i + 1}: ${found}`);
      continue;
    }
    if (!found.external_id) {
      errors.push(`Passo ${i + 1}: "${found.name}" sem ID externo Meta.`);
      continue;
    }

    if (step.action_type === 'pause_campaign') {
      if (found.status === 'PAUSED') {
        errors.push(`Passo ${i + 1}: "${found.name}" ja esta pausada (skip).`);
        continue;
      }
      resolved.push({
        action_type: 'pause_campaign',
        payload: { campaign_id: found.id, campaign_external_id: found.external_id, campaign_name: found.name },
        human_summary: `Pausar "${found.name}"`,
      });
    } else if (step.action_type === 'reactivate_campaign') {
      if (found.status === 'ACTIVE') {
        errors.push(`Passo ${i + 1}: "${found.name}" ja esta ativa (skip).`);
        continue;
      }
      resolved.push({
        action_type: 'reactivate_campaign',
        payload: { campaign_id: found.id, campaign_external_id: found.external_id, campaign_name: found.name },
        human_summary: `Reativar "${found.name}"`,
      });
    } else if (step.action_type === 'update_budget') {
      if (typeof step.daily_budget_brl !== 'number' || step.daily_budget_brl <= 0) {
        errors.push(`Passo ${i + 1}: budget invalido (${step.daily_budget_brl}).`);
        continue;
      }
      const cents = Math.round(step.daily_budget_brl * 100);
      resolved.push({
        action_type: 'update_budget',
        payload: {
          campaign_id: found.id,
          campaign_external_id: found.external_id,
          campaign_name: found.name,
          daily_budget_cents: cents,
        },
        human_summary: `Budget de "${found.name}" -> R$ ${step.daily_budget_brl.toFixed(2)}`,
      });
    } else {
      errors.push(`Passo ${i + 1}: action_type invalido (${step.action_type}).`);
    }
  }

  if (resolved.length === 0) {
    return `Nenhum passo valido no plano. Erros:\n${errors.join('\n')}`;
  }

  const summary = args.summary || `Plano com ${resolved.length} acoes`;

  // Criar plan
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      human_summary: summary,
      rationale: args.rationale ?? null,
    })
    .select('id')
    .single();

  if (planErr || !plan) {
    return `Falha ao criar plano: ${planErr?.message ?? 'unknown'}`;
  }

  // Criar approvals filhas
  const rows = resolved.map((r, idx) => ({
    company_id: companyId,
    conversation_id: conversationId,
    plan_id: plan.id,
    plan_step_order: idx,
    action_type: r.action_type,
    payload: r.payload,
    human_summary: r.human_summary,
  }));

  const { error: insErr } = await supabase.from('approvals').insert(rows);
  if (insErr) {
    // Rollback do plan
    await supabase.from('plans').delete().eq('id', plan.id);
    return `Falha ao criar passos do plano: ${insErr.message}`;
  }

  const stepsList = resolved.map((r, i) => `${i + 1}. ${r.human_summary}`).join('\n');
  const errorBlock = errors.length > 0 ? `\n\n_Avisos:_\n${errors.join('\n')}` : '';

  return `Plano criado (ID: ${plan.id}) com ${resolved.length} acoes.\n\n**${summary}**\n\n${stepsList}${errorBlock}\n\nO usuario aprova/rejeita TODAS as acoes em batch via painel de aprovacoes (expira em 5 min).`;
}

// ---------- LEGACY actions (executam direto) ----------
// Mantidas pra compatibilidade. NAO devem ser chamadas a partir do AI Chat —
// use as funcoes propose* acima. Sao usadas internamente pela Edge Function
// approval-action.

export async function pauseCampaignAction(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string }
): Promise<string> {
  const { data: campaigns } = await supabase
    .from('campaigns').select('id, external_id, name, status')
    .eq('company_id', companyId).ilike('name', `%${args.campaign_name}%`);

  if (!campaigns || campaigns.length === 0) return `Nenhuma campanha encontrada com nome "${args.campaign_name}".`;
  if (campaigns.length > 1) return `Encontrei ${campaigns.length} campanhas. Seja mais especifico:\n${campaigns.map((c) => `- ${c.name} (${c.status})`).join('\n')}`;

  const campaign = campaigns[0];
  if (campaign.status === 'PAUSED') return `"${campaign.name}" ja esta pausada.`;
  if (!campaign.external_id) return `"${campaign.name}" sem ID externo Meta.`;

  const { data: integration } = await supabase.from('integrations').select('access_token').eq('company_id', companyId).eq('platform', 'meta').single();
  if (!integration?.access_token) return 'Token Meta nao encontrado.';
  const { data: decrypted } = await supabase.rpc('decrypt_meta_token', { encrypted_token: integration.access_token });
  if (!decrypted) return 'Falha ao descriptografar token.';

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION_ACTIONS}/${campaign.external_id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${decrypted}` },
    body: 'status=PAUSED',
  });
  const body = await res.json();
  if (!res.ok) return `Erro Meta API: ${JSON.stringify(body.error ?? body).substring(0, 200)}`;

  await supabase.from('fury_actions').insert({
    company_id: companyId, campaign_id: campaign.id, campaign_external_id: campaign.external_id,
    campaign_name: campaign.name, rule_key: 'manual_chat', rule_display_name: 'Comando via Chat',
    action_type: 'pause', status: 'executed', performed_by: 'user_chat', meta_api_response: body,
    revert_before: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  return `Campanha "${campaign.name}" **pausada** com sucesso. Reversivel por 30 min na aba FURY.`;
}

export async function reactivateCampaignAction(
  supabase: SupabaseClient,
  companyId: string,
  args: { campaign_name: string }
): Promise<string> {
  const { data: campaigns } = await supabase
    .from('campaigns').select('id, external_id, name, status')
    .eq('company_id', companyId).ilike('name', `%${args.campaign_name}%`);

  if (!campaigns || campaigns.length === 0) return `Nenhuma campanha encontrada com nome "${args.campaign_name}".`;
  if (campaigns.length > 1) return `Encontrei ${campaigns.length} campanhas. Seja mais especifico:\n${campaigns.map((c) => `- ${c.name} (${c.status})`).join('\n')}`;

  const campaign = campaigns[0];
  if (!campaign.external_id) return `"${campaign.name}" sem ID externo Meta.`;

  const { data: integration } = await supabase.from('integrations').select('access_token').eq('company_id', companyId).eq('platform', 'meta').single();
  if (!integration?.access_token) return 'Token Meta nao encontrado.';
  const { data: decrypted } = await supabase.rpc('decrypt_meta_token', { encrypted_token: integration.access_token });
  if (!decrypted) return 'Falha ao descriptografar token.';

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION_ACTIONS}/${campaign.external_id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${decrypted}` },
    body: 'status=ACTIVE',
  });
  const body = await res.json();
  if (!res.ok) return `Erro Meta API: ${JSON.stringify(body.error ?? body).substring(0, 200)}`;

  await supabase.from('fury_actions').insert({
    company_id: companyId, campaign_id: campaign.id, campaign_external_id: campaign.external_id,
    campaign_name: campaign.name, rule_key: 'manual_chat', rule_display_name: 'Comando via Chat',
    action_type: 'revert', status: 'executed', performed_by: 'user_chat', meta_api_response: body,
  });
  return `Campanha "${campaign.name}" **reativada** com sucesso!`;
}

// knowledge-base-rag: busca semantica em documentos do cliente.
// Gera embedding da query, chama RPC search_knowledge, formata resultado
// com refs [doc:X#chunk:Y] para a IA citar.
export async function searchKnowledge(
  supabase: SupabaseClient,
  companyId: string,
  args: { query: string; top_k?: number; filters?: Record<string, unknown> },
): Promise<string> {
  if (!companyId) return 'Sem empresa associada — search_knowledge indisponivel.';
  if (!args.query || args.query.trim().length < 3) {
    return 'Query muito curta para busca semantica. Forneca uma pergunta com mais contexto.';
  }
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return 'OpenAI nao configurado — search_knowledge indisponivel.';

  const embResp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: args.query }),
  });
  if (!embResp.ok) {
    return `Falha ao gerar embedding (${embResp.status})`;
  }
  const embJson = await embResp.json();
  const queryEmbedding = embJson.data?.[0]?.embedding as number[] | undefined;
  if (!queryEmbedding) return 'Embedding malformado.';

  const topK = Math.max(1, Math.min(20, args.top_k ?? 8));
  const queryPreview = args.query.slice(0, 200);

  const { data, error } = await supabase.rpc('search_knowledge', {
    p_company_id: companyId,
    p_query_embedding: queryEmbedding,
    p_top_k: topK,
    p_filters: args.filters ?? {},
    p_query_preview: queryPreview,
  });
  if (error) return `Erro na busca: ${error.message}`;

  const rows = (data as Array<{
    chunk_id: string;
    document_id: string;
    document_title: string;
    document_type: string;
    chunk_text: string;
    chunk_index: number;
    page_number: number | null;
    score: number;
    is_source_of_truth: boolean;
  }>) ?? [];

  if (rows.length === 0) {
    return 'Nenhum documento relevante encontrado na memoria do cliente para esta query.';
  }

  const lines = rows.map((r, i) => {
    const snippet = r.chunk_text.length > 600 ? r.chunk_text.slice(0, 600) + '...' : r.chunk_text;
    const sotMark = r.is_source_of_truth ? ' [fonte de verdade]' : '';
    const pageMark = r.page_number ? ` p.${r.page_number}` : '';
    return `### Resultado ${i + 1} — ${r.document_title} (${r.document_type}${pageMark})${sotMark}\nRef: [doc:${r.document_id}#chunk:${r.chunk_index}]\nScore: ${r.score.toFixed(3)}\n\n${snippet}`;
  });

  return [
    `Encontrados ${rows.length} trechos relevantes na memoria do cliente.`,
    'IMPORTANTE: ao usar qualquer trecho na resposta, cite a Ref no formato [doc:UUID#chunk:N] como vem nos resultados. NUNCA invente refs.',
    '',
    ...lines,
  ].join('\n');
}
