import { memo, useMemo, useState } from 'react';
import { useCampaignMetrics } from '@/hooks/use-campaigns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DashFilters, type Period } from './dashboard/DashFilters';
import { DashKpiGrid, type MetricRow } from './dashboard/DashKpiGrid';
import { DashCharts } from './dashboard/DashCharts';
import { DashFuryTimeline } from './dashboard/DashFuryTimeline';

function periodDays(p: Period): number {
  if (p === 'today') return 1;
  if (p === '7d') return 7;
  return 30;
}

function dateRange(p: Period): { start: string; end: string } {
  const end = new Date().toISOString().split('T')[0];
  const days = periodDays(p);
  const start = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0];
  return { start, end };
}

function previousDateRange(p: Period): { start: string; end: string } {
  const days = periodDays(p);
  const start = new Date(Date.now() - 2 * days * 86400_000).toISOString().split('T')[0];
  const end = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0];
  return { start, end };
}

const DashboardView = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  // Buscar sempre 60 dias pra ter current + previous
  const metricsQ = useCampaignMetrics(60);

  // Ad accounts pra filtro
  const { data: accounts = [] } = useQuery<Array<{ account_id: string; account_name: string | null }>>({
    queryKey: ['ad-accounts-for-dash'],
    queryFn: async () => {
      const { data } = await supabase
        .from('meta_ad_accounts' as any)
        .select('account_id, account_name')
        .is('deleted_at', null) as any;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const all = metricsQ.data ?? [];

  // Partition em current + previous
  const { currentMetrics, previousMetrics, campaignNames } = useMemo(() => {
    const { start: curStart, end: curEnd } = dateRange(period);
    const { start: prevStart, end: prevEnd } = previousDateRange(period);

    const curr: MetricRow[] = [];
    const prev: MetricRow[] = [];
    const names = new Set<string>();

    for (const m of all) {
      if (!m.data) continue;
      if (m.campanha) names.add(m.campanha);

      // Aplica filtros
      if (selectedCampaigns.length > 0 && m.campanha && !selectedCampaigns.includes(m.campanha)) continue;
      // (accounts filter requer join — v1 ignora se nao tem mapeamento campanha→account no metric)

      if (m.data >= curStart && m.data <= curEnd) curr.push(m as MetricRow);
      else if (m.data >= prevStart && m.data <= prevEnd) prev.push(m as MetricRow);
    }

    return { currentMetrics: curr, previousMetrics: prev, campaignNames: [...names].sort() };
  }, [all, period, selectedCampaigns]);

  const loading = metricsQ.isLoading;
  const error = metricsQ.isError;

  return (
    <div className="mx-auto h-full max-w-[1600px] animate-fade-in space-y-6 overflow-y-auto p-4 md:p-6 xl:p-8">
      <PageHeader
        title="Dashboard"
        description="Visão geral das campanhas Meta Ads"
        badge={
          <div className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            error
              ? 'border-red-500/20 bg-red-500/10 text-red-500'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              error ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'
            )} />
            {error ? 'Erro' : loading ? 'Carregando' : 'Ao vivo · 5min'}
          </div>
        }
      />

      {/* Filters */}
      <DashFilters
        period={period}
        onPeriodChange={setPeriod}
        accounts={accounts}
        selectedAccounts={selectedAccounts}
        onSelectedAccountsChange={setSelectedAccounts}
        campaigns={campaignNames}
        selectedCampaigns={selectedCampaigns}
        onSelectedCampaignsChange={setSelectedCampaigns}
      />

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-card p-8 shadow-e1">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <p className="text-sm text-muted-foreground">Erro ao carregar métricas</p>
          <Button size="sm" variant="outline" onClick={() => metricsQ.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* KPIs */}
      {!error && (
        <DashKpiGrid
          currentMetrics={currentMetrics}
          previousMetrics={previousMetrics}
          loading={loading}
        />
      )}

      {/* Charts + Timeline — stack em telas medias, lado a lado em xl (≥1280px) */}
      {!error && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <DashCharts metrics={currentMetrics} loading={loading} />
          </div>
          <div className="xl:col-span-1 min-h-[400px] xl:min-h-[600px]">
            <DashFuryTimeline />
          </div>
        </div>
      )}

      {/* Empty state (carregou mas sem dados) */}
      {!error && !loading && currentMetrics.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-1 text-sm text-foreground/80">Nenhuma métrica no período selecionado.</p>
          <p className="text-xs text-muted-foreground">Va em Integrações e clique em Sincronizar, ou escolha outro período.</p>
        </div>
      )}
    </div>
  );
};

export default memo(DashboardView);
