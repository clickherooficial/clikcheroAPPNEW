// agent-execution-loop (Sprint 5/8) — card de plan na lista.
import { CheckCircle2, XCircle, AlertCircle, Loader2, Play, Square, Clock, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Plan, PlanWithSteps } from '@/hooks/use-plans';

const STATUS_META: Record<Plan['status'], { label: string; tone: string; icon: React.ElementType }> = {
  pending: { label: 'Aguardando aprovação', tone: 'text-amber-400 border-amber-500/40', icon: Clock },
  approved: { label: 'Aprovado, pronto pra executar', tone: 'text-blue-400 border-blue-500/40', icon: ListChecks },
  rejected: { label: 'Rejeitado', tone: 'text-muted-foreground border-border', icon: XCircle },
  expired: { label: 'Expirado', tone: 'text-muted-foreground border-border', icon: Clock },
  executed: { label: 'Executado com sucesso', tone: 'text-emerald-400 border-emerald-500/40', icon: CheckCircle2 },
  partial: { label: 'Parcial', tone: 'text-amber-400 border-amber-500/40', icon: AlertCircle },
  failed: { label: 'Falhou', tone: 'text-destructive border-destructive/40', icon: XCircle },
  running: { label: 'Executando…', tone: 'text-blue-400 border-blue-500/40', icon: Loader2 },
  rolled_back: { label: 'Revertido', tone: 'text-muted-foreground border-border', icon: XCircle },
  aborted: { label: 'Abortado', tone: 'text-muted-foreground border-border', icon: XCircle },
};

interface Props {
  plan: PlanWithSteps;
  busy: boolean;
  onExecute: (planId: string) => void;
  onAbort: (planId: string) => void;
}

export function PlanCard({ plan, busy, onExecute, onAbort }: Props) {
  const meta = STATUS_META[plan.status];
  const Icon = meta.icon;
  const total = plan.steps.length;
  const executed = plan.executed_steps_count ?? plan.steps.filter((s) => s.status === 'executed').length;
  const progress = total > 0 ? (executed / total) * 100 : 0;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('gap-1', meta.tone)}>
              <Icon className={cn('h-3 w-3', plan.status === 'running' && 'animate-spin')} />
              {meta.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(plan.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{plan.human_summary}</p>
          {plan.rationale && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{plan.rationale}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {plan.status === 'approved' && (
            <Button size="sm" onClick={() => onExecute(plan.id)} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Executar
            </Button>
          )}
          {plan.status === 'running' && (
            <Button size="sm" variant="outline" onClick={() => onAbort(plan.id)} className="gap-1">
              <Square className="h-3 w-3" />
              Abortar
            </Button>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{executed}/{total} passos</span>
            {plan.failed_at_step != null && <span className="text-destructive">Falhou no step {plan.failed_at_step}</span>}
            {(plan.ledger_ids?.length ?? 0) > 0 && <span>{plan.ledger_ids?.length} ledger entries</span>}
          </div>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Ver {total} passo(s)</summary>
        <ol className="mt-2 space-y-1 pl-4 list-decimal">
          {plan.steps.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2">
              <span className={cn('flex-1', s.status === 'executed' && 'text-emerald-400')}>
                {s.human_summary} <span className="text-muted-foreground">({s.action_type})</span>
              </span>
              <Badge variant="outline" className="text-[9px] uppercase">{s.status}</Badge>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
