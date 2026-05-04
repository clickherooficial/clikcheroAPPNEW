import { useState } from 'react';
import {
  Activity,
  Zap,
  DollarSign,
  AlertTriangle,
  Timer,
  Loader2,
  RefreshCw,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useAiHealth } from '@/hooks/use-ai-health';
import { cn } from '@/lib/utils';

const PERIODS: Array<{ days: number; label: string }> = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
];

const AiHealthView = () => {
  const [days, setDays] = useState(7);
  const { data, isLoading, error, refresh } = useAiHealth(days);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Saúde do AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Telemetria de cada chamada do assistente: custo, latencia e falhas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-card border border-border rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
                  days === p.days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive mb-6">
          Erro ao carregar métricas: {error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando telemetria...
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard
              title="Runs"
              value={String(data.totals.total_runs)}
              hint={`${data.totals.success_runs} ok / ${data.totals.error_runs} erro`}
              icon={Zap}
            />
            <KpiCard
              title="Custo"
              value={`US$ ${Number(data.totals.total_cost_usd).toFixed(4)}`}
              hint={`${formatNumber(data.totals.total_tokens)} tokens`}
              icon={DollarSign}
            />
            <KpiCard
              title="Latencia p95"
              value={formatLatency(data.totals.p95_latency_ms)}
              hint={`p50 ${formatLatency(data.totals.p50_latency_ms)}`}
              icon={Timer}
            />
            <KpiCard
              title="Taxa de erro"
              value={`${formatErrorRate(data.totals.error_runs, data.totals.total_runs)}%`}
              hint={data.totals.error_runs === 0 ? 'tudo verde' : `${data.totals.error_runs} falhas`}
              icon={AlertTriangle}
              higherIsBetter={false}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <ChartCard title="Custo / dia (USD)">
              {data.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${Number(v).toFixed(3)}`} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`$${Number(v).toFixed(4)}`, 'Custo']}
                    />
                    <Line type="monotone" dataKey="cost_usd" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="Runs por dia (ok vs erro)">
              {data.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="errors" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>

          {/* Top tools + Recent errors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5" />
                Tools mais usadas
              </h3>
              {data.top_tools.length > 0 ? (
                <div className="space-y-1.5">
                  {data.top_tools.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/80 font-mono text-xs truncate">{t.name}</span>
                      <span className="text-muted-foreground tabular-nums">{t.uses}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 py-4 text-center">
                  Nenhuma tool usada nesse período.
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                {data.recent_errors.length === 0 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Sem erros recentes
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    Erros recentes ({data.recent_errors.length})
                  </>
                )}
              </h3>
              {data.recent_errors.length > 0 ? (
                <div className="space-y-2">
                  {data.recent_errors.slice(0, 5).map((e) => (
                    <div key={e.id} className="text-xs border-l-2 border-red-500/40 pl-2">
                      <div className="text-muted-foreground/70">
                        {new Date(e.started_at).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-foreground/90 font-mono break-words">
                        {e.error_message ?? '(sem mensagem)'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 py-4 text-center">
                  Tudo verde. Nenhum erro nos últimos {data.period_days} dias.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground/60">
      Sem dados ainda.
    </div>
  );
}

function formatLatency(ms: number): string {
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatErrorRate(errors: number, total: number): string {
  if (total === 0) return '0.0';
  return ((errors / total) * 100).toFixed(1);
}

function formatNumber(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

export default AiHealthView;
