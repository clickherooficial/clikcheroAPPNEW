import { useMemo } from 'react';
import { MousePointerClick, Wallet, Target, Receipt, Eye, Percent } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { KpiCardCompact } from '@/components/shared/KpiCardCompact';
import { fmtBRL } from '@/lib/meta-labels';

export interface MetricRow {
  data: string | null;
  campanha: string | null;
  investimento: number | null;
  conversas_iniciadas: number | null;
  impressoes: number | null;
  cliques: number | null;
  website_purchase_roas: number | null;
}

interface Props {
  currentMetrics: MetricRow[];
  previousMetrics: MetricRow[];
  loading: boolean;
}

interface Totals {
  investimento: number;
  conversas: number;
  receita: number;
  lucro: number;
  impressoes: number;
  cliques: number;
  cpl: number | null;
  ctr: number | null;          // cliques / impressoes
  cpc: number | null;          // investimento / cliques
  cpm: number | null;          // investimento / impressoes * 1000
  conv_rate: number | null;    // conversas / cliques
}

function computeTotals(metrics: MetricRow[]): Totals {
  let investimento = 0, conversas = 0, receita = 0, impressoes = 0, cliques = 0;
  for (const m of metrics) {
    const spend = Number(m.investimento) || 0;
    const roas = Number(m.website_purchase_roas) || 0;
    investimento += spend;
    conversas += Number(m.conversas_iniciadas) || 0;
    impressoes += Number(m.impressoes) || 0;
    cliques += Number(m.cliques) || 0;
    receita += spend * roas;
  }
  const lucro = receita - investimento;
  return {
    investimento,
    conversas,
    receita,
    lucro,
    impressoes,
    cliques,
    cpl: conversas > 0 ? investimento / conversas : null,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : null,
    cpc: cliques > 0 ? investimento / cliques : null,
    cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : null,
    conv_rate: cliques > 0 ? (conversas / cliques) * 100 : null,
  };
}

function delta(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function fmtOrDash(value: number | null, formatter: (n: number) => string): string {
  return value == null ? '—' : formatter(value);
}

/**
 * Constroi serie diaria agregada para sparklines.
 * Retorna array de valores por dia ordenado cronologicamente.
 */
function dailySeries(metrics: MetricRow[], pick: (t: Totals) => number | null): number[] {
  const byDay = new Map<string, MetricRow[]>();
  for (const m of metrics) {
    if (!m.data) continue;
    if (!byDay.has(m.data)) byDay.set(m.data, []);
    byDay.get(m.data)!.push(m);
  }
  const dates = [...byDay.keys()].sort();
  return dates
    .map((d) => pick(computeTotals(byDay.get(d)!)))
    .filter((v): v is number => v != null && isFinite(v));
}

export function DashKpiGrid({ currentMetrics, previousMetrics, loading }: Props) {
  const { cur, prev, sparks } = useMemo(() => ({
    cur: computeTotals(currentMetrics),
    prev: computeTotals(previousMetrics),
    sparks: {
      invest: dailySeries(currentMetrics, (t) => t.investimento),
      cliques: dailySeries(currentMetrics, (t) => t.cliques),
      conversas: dailySeries(currentMetrics, (t) => t.conversas),
    },
  }), [currentMetrics, previousMetrics]);

  // Tier 1 — cards grandes com sparkline (metricas objetivas: brutos do anuncio)
  const tier1 = [
    {
      label: 'Investimento',
      value: fmtBRL(cur.investimento),
      deltaPct: delta(cur.investimento, prev.investimento),
      higherIsBetter: false,
      icon: Wallet,
      spark: sparks.invest,
    },
    {
      label: 'Cliques',
      value: cur.cliques.toLocaleString('pt-BR'),
      deltaPct: delta(cur.cliques, prev.cliques),
      higherIsBetter: true,
      icon: MousePointerClick,
      spark: sparks.cliques,
    },
    {
      label: 'Conversões (leads · msgs)',
      value: cur.conversas.toLocaleString('pt-BR'),
      deltaPct: delta(cur.conversas, prev.conversas),
      higherIsBetter: true,
      icon: Target,
      spark: sparks.conversas,
    },
  ];

  // Tier 2 — compactos (taxas e custos unitarios)
  const tier2 = [
    {
      label: 'Impressoes',
      value: cur.impressoes.toLocaleString('pt-BR'),
      deltaPct: delta(cur.impressoes, prev.impressoes),
      higherIsBetter: true,
      icon: Eye,
    },
    {
      label: 'CTR',
      value: fmtOrDash(cur.ctr, (v) => v.toFixed(2)),
      unit: cur.ctr != null ? '%' : undefined,
      deltaPct: delta(cur.ctr, prev.ctr),
      higherIsBetter: true,
      icon: Percent,
    },
    {
      label: 'CPL / CPA',
      value: fmtOrDash(cur.cpl, fmtBRL),
      deltaPct: delta(cur.cpl, prev.cpl),
      higherIsBetter: false,
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tier1.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={loading ? '—' : c.value}
            unit={c.unit}
            deltaPct={loading ? null : c.deltaPct}
            higherIsBetter={c.higherIsBetter}
            icon={c.icon}
            sparklineData={loading ? undefined : c.spark}
            accentClassName={c.accent}
            loading={loading}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tier2.map((c) => (
          <KpiCardCompact
            key={c.label}
            label={c.label}
            value={loading ? '—' : c.value}
            unit={c.unit}
            deltaPct={loading ? null : c.deltaPct}
            higherIsBetter={c.higherIsBetter}
            icon={c.icon}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}
