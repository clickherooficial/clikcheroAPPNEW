import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtBRL } from '@/lib/meta-labels';
import type { MetricRow } from './DashKpiGrid';

const COLORS = ['#cf6f03', '#059669', '#3b82f6', '#ec4899', '#8b5cf6', '#71717a'];

interface Props {
  metrics: MetricRow[];
}

interface TooltipItem { value?: number; name?: string; payload?: { name?: string; value?: number } }

function CustomTooltip({ active, payload, total }: { active?: boolean; payload?: TooltipItem[]; total: number }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = Number(item.value ?? 0);
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-e3 backdrop-blur-sm">
      <div className="mb-1 max-w-[240px] truncate text-xs font-medium text-foreground">{item.payload?.name}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Investimento</span>
        <span className="ml-auto font-mono font-semibold tabular-nums text-foreground">{fmtBRL(value)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Participacao</span>
        <span className="ml-auto font-mono font-semibold tabular-nums text-primary">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

interface LabelProps { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number }

function renderInsideLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: LabelProps) {
  if (percent < 0.05) return null; // esconde labels em fatias muito pequenas
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const RADIAN = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      className="font-mono text-[11px] font-semibold tabular-nums"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PieChartSpendByCampaign({ metrics }: Props) {
  const { data, total } = useMemo(() => {
    const byCampaign = new Map<string, number>();
    for (const m of metrics) {
      if (!m.campanha) continue;
      const cur = byCampaign.get(m.campanha) ?? 0;
      byCampaign.set(m.campanha, cur + (Number(m.investimento) || 0));
    }
    const sorted = [...byCampaign.entries()]
      .map(([name, spend]) => ({ name, spend }))
      .sort((a, b) => b.spend - a.spend);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const result = top5.map((c) => ({ name: c.name, value: c.spend }));
    if (others.length > 0) {
      result.push({ name: 'Outros', value: others.reduce((s, c) => s + c.spend, 0) });
    }
    const total = result.reduce((s, d) => s + d.value, 0);
    return { data: result, total };
  }, [metrics]);

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Sem gasto no período
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius="90%"
              innerRadius="55%"
              paddingAngle={1.5}
              dataKey="value"
              label={renderInsideLabel}
              labelLine={false}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col justify-center gap-1.5">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
