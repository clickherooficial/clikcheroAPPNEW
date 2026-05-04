// meta-edits-suite (Sprint 2/8) — preview de impacto de mudanca de budget.
// Mostra delta absoluto, % e projecao 30d consultando estimate_budget_change_impact.
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useBudgetImpact } from '@/hooks/use-meta-edits';
import { cn } from '@/lib/utils';

interface Props {
  campaignId: string;
  newDailyBudget: number | null;
}

export function ImpactPreviewBadge({ campaignId, newDailyBudget }: Props) {
  const { data, isLoading } = useBudgetImpact(campaignId, newDailyBudget);
  if (!newDailyBudget || isLoading) {
    return <div className="text-xs text-muted-foreground">—</div>;
  }
  if (!data || 'error' in data) {
    return <div className="text-xs text-destructive">erro</div>;
  }
  const positive = data.delta_brl > 0;
  const negative = data.delta_brl < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
      positive && 'border-orange-500/40 text-orange-400 bg-orange-500/5',
      negative && 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
      !positive && !negative && 'border-border text-muted-foreground',
    )}>
      <Icon className="h-3 w-3" />
      <span className="font-mono">
        {data.delta_brl >= 0 ? '+' : ''}R${data.delta_brl.toFixed(2)}
        {data.delta_pct != null && <> ({data.delta_pct >= 0 ? '+' : ''}{data.delta_pct}%)</>}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">30d ≈ R${data.projection_30d_brl.toFixed(0)}</span>
    </div>
  );
}
