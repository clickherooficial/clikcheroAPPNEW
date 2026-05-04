import { TrendingUp, TrendingDown, Lightbulb, ShieldAlert, Loader2, Sparkles, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProactiveBriefing, type BriefingInsight } from '@/hooks/use-proactive-briefing';

interface Props {
  onAsk: (prompt: string) => void;
  onDismiss?: () => void;
}

export function ProactiveBanner({ onAsk }: Props) {
  const { insights, isLoading } = useProactiveBriefing();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analisando suas memórias e métricas...
      </div>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Briefing proativo
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} onAsk={onAsk} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  onAsk,
}: {
  insight: BriefingInsight;
  onAsk: (prompt: string) => void;
}) {
  const Icon =
    insight.kind === 'compliance_alert'
      ? AlertOctagon
      : insight.kind === 'metric_drop'
        ? TrendingDown
        : insight.kind === 'metric_jump'
          ? TrendingUp
          : insight.kind === 'pending_actions'
            ? ShieldAlert
            : Lightbulb;

  const severityClass =
    insight.severity === 'danger'
      ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/15'
      : insight.severity === 'warning'
        ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
        : insight.severity === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
          : 'border-border bg-card hover:bg-card/80';

  const iconClass =
    insight.severity === 'danger'
      ? 'text-red-400'
      : insight.severity === 'warning'
        ? 'text-amber-400'
        : insight.severity === 'success'
          ? 'text-emerald-400'
          : 'text-primary';

  const prompt = buildPrompt(insight);

  return (
    <button
      type="button"
      onClick={() => onAsk(prompt)}
      className={cn(
        'text-left p-3 rounded-xl border transition-all hover:-translate-y-px',
        severityClass
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconClass)} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground mb-0.5 truncate">
            {insight.title}
          </div>
          <div className="text-[11px] text-muted-foreground line-clamp-2">{insight.body}</div>
        </div>
      </div>
    </button>
  );
}

function buildPrompt(insight: BriefingInsight): string {
  switch (insight.kind) {
    case 'compliance_alert':
      return `Tenho ${insight.title.toLowerCase()}. Quais sao os anúncios afetados, qual o problema de cada um e o que você sugere fazer?`;
    case 'metric_drop':
      return `Notei que ${insight.title.toLowerCase()}. Pode investigar o que causou essa queda e sugerir o que fazer?`;
    case 'metric_jump':
      return `${insight.title}. Pode analisar o que esta funcionando e como amplificar esse resultado?`;
    case 'pending_actions':
      return 'Tem ações pendentes na fila de aprovações. Pode revisar e me explicar cada uma?';
    case 'memory':
      return `Sobre o que mencionei antes: "${insight.body}". Como isso esta agora?`;
    default:
      return insight.title;
  }
}
