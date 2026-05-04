import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useBudgetBenchmarks } from '@/hooks/use-budget-smart';

const MARKET_FALLBACK: Record<string, number> = {
  OUTCOME_LEADS: 15,
  OUTCOME_SALES: 40,
  OUTCOME_TRAFFIC: 2,
  OUTCOME_ENGAGEMENT: 1,
};

const UNIT_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'leads',
  OUTCOME_SALES: 'vendas',
  OUTCOME_TRAFFIC: 'visitantes',
  OUTCOME_ENGAGEMENT: 'interações',
};

interface Props {
  objective: string;
  goalPerWeek: number;
  budget: number;
  onBudgetChange: (v: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function BudgetSliderStep({ objective, goalPerWeek, budget, onBudgetChange, onGenerate, isGenerating }: Props) {
  const { data: benchmarks } = useBudgetBenchmarks();

  const { cpl, dataSource } = useMemo(() => {
    const tenant = benchmarks?.find((b) => b.objective === objective);
    if (tenant && tenant.samples_count >= 7 && tenant.avg_cpl) {
      return { cpl: Number(tenant.avg_cpl), dataSource: 'Histórico do tenant' };
    }
    return { cpl: MARKET_FALLBACK[objective] ?? 15, dataSource: 'Benchmark de mercado' };
  }, [benchmarks, objective]);

  const projectedVolume = Math.round(budget / cpl);
  const rangeMin = Math.round(projectedVolume * 0.8);
  const rangeMax = Math.round(projectedVolume * 1.2);
  const meetsGoal = projectedVolume >= goalPerWeek;
  const closeToGoal = projectedVolume >= goalPerWeek * 0.8;

  const statusColor = meetsGoal ? 'text-emerald-400' : closeToGoal ? 'text-amber-400' : 'text-red-400';
  const statusLabel = meetsGoal ? 'Atinge a meta' : closeToGoal ? 'Próximo da meta' : 'Insuficiente';
  const unit = UNIT_LABELS[objective] ?? 'conversões';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Quanto você quer investir?</h3>
        <p className="text-sm text-muted-foreground">Ajuste o slider e veja a projecao em tempo real.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Investimento semanal</Label>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">R$ {budget.toLocaleString('pt-BR')}</span>
            <span className="text-sm text-muted-foreground">/semana</span>
          </div>
        </div>

        <Slider
          value={[budget]}
          onValueChange={(v) => onBudgetChange(v[0])}
          min={70}
          max={10000}
          step={10}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>R$ 70 (min)</span>
          <span>R$ 10.000 (max)</span>
        </div>
      </div>

      {/* Projection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground">Projecao semanal</div>
          <div className={`text-3xl font-bold ${statusColor}`}>{projectedVolume.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-muted-foreground">{unit}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Faixa: <strong>{rangeMin.toLocaleString('pt-BR')}</strong> - <strong>{rangeMax.toLocaleString('pt-BR')}</strong>
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card space-y-2">
          <Badge variant="outline" className={`${statusColor} border-current`}>
            {statusLabel}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Meta: <strong>{goalPerWeek} {unit}/semana</strong>
          </div>
          <div className="text-xs text-muted-foreground">
            CPL usado: <strong>R$ {cpl.toFixed(2)}</strong>
          </div>
          <div className="text-xs text-muted-foreground">
            Fonte: <strong>{dataSource}</strong>
          </div>
        </div>
      </div>

      <Button onClick={onGenerate} disabled={isGenerating} className="w-full" size="lg">
        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {isGenerating ? 'Analisando com IA...' : 'Gerar Recomendação com IA'}
      </Button>
    </div>
  );
}
