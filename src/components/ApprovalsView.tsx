import { useEffect, useState } from 'react';
import { Check, X, Clock, ShieldAlert, Pause, Play, DollarSign, Loader2, CheckCircle2, AlertCircle, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useApprovals, type Approval, type ApprovalActionType } from '@/hooks/use-approvals';
import { usePlans, type PlanWithSteps } from '@/hooks/use-plans';

const ACTION_META: Record<
  ApprovalActionType,
  { icon: typeof Pause; color: string; label: string }
> = {
  pause_campaign: { icon: Pause, color: 'text-orange-400', label: 'Pausar campanha' },
  reactivate_campaign: { icon: Play, color: 'text-emerald-400', label: 'Reativar campanha' },
  update_budget: { icon: DollarSign, color: 'text-sky-400', label: 'Alterar budget' },
  pause_ad: { icon: Pause, color: 'text-orange-400', label: 'Pausar anúncio' },
  reactivate_ad: { icon: Play, color: 'text-emerald-400', label: 'Reativar anúncio' },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Pendente' },
  approved: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Aprovado' },
  rejected: { color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', label: 'Rejeitado' },
  expired: { color: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30', label: 'Expirado' },
  executed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Executado' },
  failed: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Falhou' },
};

const ApprovalsView = () => {
  const { pending, history, isLoading, decidingId, decide } = useApprovals();
  const {
    pending: pendingPlans,
    history: historyPlans,
    isLoading: plansLoading,
    decidingId: planDecidingId,
    decide: decidePlan,
  } = usePlans();

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          Aprovações
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Ações propostas pela IA aguardando sua confirmação. Pendentes expiram em 5 minutos.
        </p>
      </div>

      {isLoading || plansLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando...
        </div>
      ) : (
        <>
          {pendingPlans.length > 0 && (
            <Section
              title={`Planos pendentes (${pendingPlans.length})`}
              empty="Sem planos pendentes."
            >
              <div className="space-y-3">
                {pendingPlans.map((p) => (
                  <PendingPlanCard
                    key={p.id}
                    plan={p}
                    isDeciding={planDecidingId === p.id}
                    onDecide={decidePlan}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section
            title={`Pendentes (${pending.length})`}
            empty="Nenhuma ação aguardando aprovação."
            className={pendingPlans.length > 0 ? 'mt-6' : undefined}
          >
            <div className="space-y-3">
              {pending.map((a) => (
                <PendingCard
                  key={a.id}
                  approval={a}
                  isDeciding={decidingId === a.id}
                  onDecide={decide}
                />
              ))}
            </div>
          </Section>

          {historyPlans.length > 0 && (
            <Section
              title={`Histórico de planos (${historyPlans.length})`}
              empty="Sem planos anteriores."
              className="mt-8"
            >
              <div className="space-y-2">
                {historyPlans.slice(0, 15).map((p) => (
                  <PlanHistoryRow key={p.id} plan={p} />
                ))}
              </div>
            </Section>
          )}

          <Section title={`Histórico (${history.length})`} empty="Sem ações anteriores." className="mt-8">
            <div className="space-y-2">
              {history.slice(0, 30).map((a) => (
                <HistoryRow key={a.id} approval={a} />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
};

function Section({
  title,
  empty,
  children,
  className,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      {Array.isArray(children) || (children as { props: { children: unknown[] } })?.props?.children?.length ? (
        children
      ) : (
        <div className="text-sm text-muted-foreground/60 py-6 text-center border border-dashed border-border rounded-xl">
          {empty}
        </div>
      )}
    </section>
  );
}

function PendingCard({
  approval,
  isDeciding,
  onDecide,
}: {
  approval: Approval;
  isDeciding: boolean;
  onDecide: (id: string, decision: 'approve' | 'reject') => void;
}) {
  const meta = ACTION_META[approval.action_type] ?? {
    icon: ShieldAlert,
    color: 'text-foreground',
    label: approval.action_type,
  };
  const Icon = meta.icon;

  const remainingMs = new Date(approval.expires_at).getTime() - Date.now();
  const expired = remainingMs <= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:bg-card/80 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('h-9 w-9 rounded-lg bg-background flex items-center justify-center shrink-0', meta.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </div>
            <div className="text-sm font-medium text-foreground mt-0.5 truncate">
              {approval.human_summary}
            </div>
            <CountdownBadge expiresAt={approval.expires_at} />
            {Object.keys(approval.payload).length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                  Ver detalhes do payload
                </summary>
                <pre className="mt-1 text-[11px] bg-background border border-border rounded-md p-2 overflow-x-auto text-muted-foreground">
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeciding || expired}
            onClick={() => onDecide(approval.id, 'reject')}
            className="border-border hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isDeciding || expired}
            onClick={() => onDecide(approval.id, 'approve')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isDeciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
        </div>
      </div>
    </div>
  );
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500">
        <Clock className="h-3 w-3" /> Expirado
      </span>
    );
  }
  const seconds = Math.floor(remaining / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const isUrgent = remaining < 60_000;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 mt-1.5 text-[11px]',
        isUrgent ? 'text-red-400' : 'text-amber-400'
      )}
    >
      <Clock className="h-3 w-3" /> Expira em {mm}:{ss.toString().padStart(2, '0')}
    </span>
  );
}

function HistoryRow({ approval }: { approval: Approval }) {
  const meta = ACTION_META[approval.action_type] ?? {
    icon: ShieldAlert,
    color: 'text-foreground',
    label: approval.action_type,
  };
  const Icon = meta.icon;
  const status = STATUS_META[approval.status] ?? STATUS_META.expired;

  const StatusIcon =
    approval.status === 'executed'
      ? CheckCircle2
      : approval.status === 'failed'
      ? AlertCircle
      : null;

  return (
    <div className="bg-card/50 border border-border/60 rounded-lg px-3 py-2 flex items-center gap-3">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
      <div className="text-sm text-foreground/80 truncate flex-1">{approval.human_summary}</div>
      <span
        className={cn(
          'text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap',
          status.color
        )}
      >
        {StatusIcon && <StatusIcon className="h-2.5 w-2.5 inline mr-0.5" />}
        {status.label}
      </span>
      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
        {timeAgo(approval.decided_at ?? approval.created_at)}
      </span>
    </div>
  );
}

function PendingPlanCard({
  plan,
  isDeciding,
  onDecide,
}: {
  plan: PlanWithSteps;
  isDeciding: boolean;
  onDecide: (id: string, decision: 'approve' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const remainingMs = new Date(plan.expires_at).getTime() - Date.now();
  const expired = remainingMs <= 0;

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4 hover:bg-card/80 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-primary">
              Plano multi-step ({plan.steps.length} ações)
            </div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {plan.human_summary}
            </div>
            {plan.rationale && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">"{plan.rationale}"</p>
            )}
            <CountdownBadge expiresAt={plan.expires_at} />

            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? 'Esconder' : 'Mostrar'} passos
            </button>

            {expanded && (
              <ol className="mt-2 space-y-1.5 list-none">
                {plan.steps.map((step, i) => {
                  const meta = ACTION_META[step.action_type] ?? {
                    icon: ShieldAlert,
                    color: 'text-foreground',
                    label: step.action_type,
                  };
                  const Icon = meta.icon;
                  return (
                    <li key={step.id} className="flex items-center gap-2 text-xs text-foreground/80">
                      <span className="text-muted-foreground font-mono w-4">{i + 1}.</span>
                      <Icon className={cn('h-3 w-3 shrink-0', meta.color)} />
                      <span className="truncate">{step.human_summary}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeciding || expired}
            onClick={() => onDecide(plan.id, 'reject')}
            className="border-border hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar tudo
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isDeciding || expired}
            onClick={() => onDecide(plan.id, 'approve')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isDeciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Aprovar plano
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanHistoryRow({ plan }: { plan: PlanWithSteps }) {
  const planStatusMeta: Record<string, { color: string; label: string }> = {
    rejected: STATUS_META.rejected,
    expired: STATUS_META.expired,
    executed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Executado' },
    partial: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Parcial' },
    failed: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Falhou' },
    approved: STATUS_META.approved,
  };
  const status = planStatusMeta[plan.status] ?? STATUS_META.expired;

  return (
    <div className="bg-card/50 border border-border/60 rounded-lg px-3 py-2 flex items-center gap-3">
      <Layers className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <div className="text-sm text-foreground/80 truncate flex-1">
        {plan.human_summary}
        <span className="ml-2 text-[11px] text-muted-foreground">({plan.steps.length} ações)</span>
      </div>
      <span
        className={cn(
          'text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap',
          status.color
        )}
      >
        {status.label}
      </span>
      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
        {timeAgo(plan.decided_at ?? plan.created_at)}
      </span>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s atras`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m atras`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h atras`;
  return `${Math.floor(diffSec / 86400)}d atras`;
}

export default ApprovalsView;
