import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtBRL, fmtCompact } from '@/lib/meta-labels';
import type { MetricRow } from './DashKpiGrid';

interface Props {
  metrics: MetricRow[];
}

const PRIMARY = '#cf6f03';
const EMERALD = '#059669';

interface TooltipItem { name?: string; value?: number; dataKey?: string }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const labelDate = label ? new Date(label).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-e3 backdrop-blur-sm">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{labelDate}</div>
      {payload.map((p, i) => {
        const isSpend = p.dataKey === 'investimento';
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: isSpend ? PRIMARY : EMERALD }}
            />
            <span className="text-muted-foreground">{isSpend ? 'Investimento' : 'Conversas'}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums text-foreground">
              {isSpend ? fmtBRL(Number(p.value)) : Number(p.value).toLocaleString('pt-BR')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChartSpendVsConv({ metrics }: Props) {
  const data = useMemo(() => {
    const byDay = new Map<string, { data: string; investimento: number; conversas: number }>();
    for (const m of metrics) {
      if (!m.data) continue;
      const cur = byDay.get(m.data) ?? { data: m.data, investimento: 0, conversas: 0 };
      cur.investimento += Number(m.investimento) || 0;
      cur.conversas += Number(m.conversas_iniciadas) || 0;
      byDay.set(m.data, cur);
    }
    return [...byDay.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [metrics]);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Sem dados no período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="conv-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.2} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
        <XAxis
          dataKey="data"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          }}
          tickMargin={8}
        />
        <YAxis
          yAxisId="spend"
          orientation="left"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtCompact(v)}
          width={50}
        />
        <YAxis
          yAxisId="conv"
          orientation="right"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          iconType="square"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">
              {value === 'investimento' ? 'Investimento' : 'Conversas'}
            </span>
          )}
        />
        <Area
          yAxisId="spend"
          type="monotone"
          dataKey="investimento"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#spend-gradient)"
          name="investimento"
        />
        <Area
          yAxisId="conv"
          type="monotone"
          dataKey="conversas"
          stroke={EMERALD}
          strokeWidth={2}
          fill="url(#conv-gradient)"
          name="conversas"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
