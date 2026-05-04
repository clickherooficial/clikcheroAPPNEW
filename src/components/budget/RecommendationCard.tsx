import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, TrendingUp, Database } from 'lucide-react';
import type { BudgetRecommendation } from '@/hooks/use-budget-smart';

const UNIT_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'leads',
  OUTCOME_SALES: 'vendas',
  OUTCOME_TRAFFIC: 'visitantes',
  OUTCOME_ENGAGEMENT: 'interações',
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  tenant_history: 'Histórico do tenant',
  market_fallback: 'Benchmark de mercado',
  mixed: 'Histórico limitado + mercado',
};

interface Props {
  recommendation: BudgetRecommendation;
  objective: string;
}

export function RecommendationCard({ recommendation: r, objective }: Props) {
  const unit = UNIT_LABELS[objective] ?? 'conversões';

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Recomendação da IA</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Orçamento recomendado</div>
            <div className="text-2xl font-bold text-primary">R$ {r.recommended_budget_weekly.toLocaleString('pt-BR')}</div>
            <div className="text-xs text-muted-foreground">por semana (R$ {r.recommended_daily.toFixed(2)}/dia)</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Volume projetado</div>
            <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {r.projected_volume.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">
              {unit}/semana ({r.projected_range_min.toLocaleString('pt-BR')} - {r.projected_range_max.toLocaleString('pt-BR')})
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-card border">
          <p className="text-sm leading-relaxed">{r.justification}</p>
        </div>

        {r.alerts.length > 0 && (
          <div className="space-y-2">
            {r.alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">{alert}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Database className="w-3 h-3" />
          Fonte: <Badge variant="outline" className="text-xs">{DATA_SOURCE_LABELS[r.data_source]}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
