// B4: Cards inline de approvals/plans pendentes dentro do chat.
// Renderizado pelo ChatView abaixo da ultima mensagem assistant quando ha
// acoes pendentes para a conversation atual.

import { useEffect, useState } from 'react';
import { Check, X, Clock, Pause, Play, DollarSign, Layers, Loader2, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useConversationActions } from '@/hooks/use-conversation-actions';
import type { Approval, ApprovalActionType } from '@/hooks/use-approvals';
import type { PlanWithSteps } from '@/hooks/use-plans';

const ACTION_META: Record<ApprovalActionType, { icon: typeof Pause; color: string; label: string }> = {
  pause_campaign: { icon: Pause, color: 'text-orange-400', label: 'Pausar' },
  pause_ad: { icon: Pause, color: 'text-orange-400', label: 'Pausar anúncio' },
  reactivate_ad: { icon: Play, color: 'text-emerald-400', label: 'Reativar anúncio' },
  reactivate_campaign: { icon: Play, color: 'text-emerald-400', label: 'Reativar' },
  update_budget: { icon: DollarSign, color: 'text-sky-400', label: 'Budget' },
};

interface Props {
  conversationId: string | null;
}

export function InlineApprovalCards({ conversationId }: Props) {
  const { pendingApprovals, pendingPlans, decidingId, decideApproval, decidePlan } =
    useConversationActions(conversationId);

  if (!conversationId || (pendingApprovals.length === 0 && pendingPlans.length === 0)) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-2 my-2">
      {pendingPlans.map((plan) => (
        <InlinePlanCard
          key={plan.id}
          plan={plan}
          isDeciding={decidingId === plan.id}
          onDecide={decidePlan}
        />
      ))}
      {pendingApprovals.map((approval) => (
        <InlineApprovalRow
          key={approval.id}
          approval={approval}
          isDeciding={decidingId === approval.id}
          onDecide={decideApproval}
        />
      ))}
    </div>
  );
}

function InlineApprovalRow({
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
    <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className={cn('h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center shrink-0', meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground truncate">
          {approval.human_summary}
        </div>
        <Countdown expiresAt={approval.expires_at} />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={isDeciding || expired}
        onClick={() => onDecide(approval.id, 'reject')}
        className="h-7 px-2 text-xs"
      >
        <X className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        disabled={isDeciding || expired}
        onClick={() => onDecide(approval.id, 'approve')}
        className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        {isDeciding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Aprovar
      </Button>
    </div>
  );
}

function InlinePlanCard({
  plan,
  isDeciding,
  onDecide,
}: {
  plan: PlanWithSteps;
  isDeciding: boolean;
  onDecide: (id: string, decision: 'approve' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const remainingMs = new Date(plan.expires_at).getTime() - Date.now();
  const expired = remainingMs <= 0;

  return (
    <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center shrink-0 text-primary">
          <Layers className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Plano com {plan.steps.length} ações
          </div>
          <div className="text-[13px] font-medium text-foreground mt-0.5">
            {plan.human_summary}
          </div>
          <Countdown expiresAt={plan.expires_at} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Esconder' : 'Ver passos'}
          </button>
          {expanded && (
            <ol className="mt-1.5 space-y-1 text-xs text-foreground/80">
              {plan.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono w-4 shrink-0">{i + 1}.</span>
                  <span className="truncate">{s.human_summary}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            size="sm"
            disabled={isDeciding || expired}
            onClick={() => onDecide(plan.id, 'approve')}
            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isDeciding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Aprovar tudo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isDeciding || expired}
            onClick={() => onDecide(plan.id, 'reject')}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
            Rejeitar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) {
    return <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Expirado</span>;
  }
  const seconds = Math.floor(remaining / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const urgent = remaining < 60_000;
  return (
    <span className={cn('text-[11px] inline-flex items-center gap-1', urgent ? 'text-red-400' : 'text-amber-400')}>
      <Clock className="h-3 w-3" />
      {mm}:{ss.toString().padStart(2, '0')}
    </span>
  );
}
