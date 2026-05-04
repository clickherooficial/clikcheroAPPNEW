// Banner de quota de geracao de criativos.
// Spec: ai-creative-generation (task 9.3 — R6.3, R6.4)

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useCreativeUsage } from '@/hooks/use-creative-usage';
import type { UsageDimension } from '@/types/creative';

const DIM_LABELS: Record<UsageDimension, string> = {
  daily: 'criativos hoje',
  monthly: 'criativos no mes',
  cost: 'custo do mes',
};

export function CreativeUsageBanner() {
  const usage = useCreativeUsage();

  if (usage.isLoading || usage.status === 'ok') return null;

  const isBlocked = usage.status === 'blocked';
  const dims = isBlocked ? usage.blocked_dimensions : usage.warning_dimensions;
  const labels = dims.map((d) => DIM_LABELS[d] ?? d).join(', ');

  return (
    <Alert variant={isBlocked ? 'destructive' : 'default'} className="mb-4">
      {isBlocked ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>
        {isBlocked
          ? 'Quota de geração atingida'
          : 'Quota de geração perto do limite'}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          {isBlocked
            ? `Você atingiu 100% de ${labels}. Novas gerações ficam bloqueadas ate fazer upgrade ou virar o ciclo.`
            : `Você esta usando >=80% de ${labels}. Considere fazer upgrade ou descartar criativos antigos.`}
        </p>
        <p className="text-xs">
          {usage.daily.count} / {usage.daily.max} hoje ·{' '}
          {usage.monthly.count} / {usage.monthly.max} no mes ·{' '}
          US$ {usage.cost_usd_month.value.toFixed(2)} / US$ {usage.cost_usd_month.max.toFixed(2)}
        </p>
      </AlertDescription>
    </Alert>
  );
}
