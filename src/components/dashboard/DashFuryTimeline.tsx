import { useFuryActions, type FuryAction } from '@/hooks/use-fury';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HumanizedAction {
  emoji: string;
  text: React.ReactNode;
  tone: 'critical' | 'info' | 'success';
}

function humanize(a: FuryAction): HumanizedAction {
  const name = <strong className="text-foreground">{a.campaign_name ?? 'Campanha'}</strong>;
  const val = a.metric_value;
  const thr = a.threshold_value;

  switch (a.rule_key) {
    case 'saturation':
      return { emoji: '⏸️', tone: 'critical', text: <>Pausei {name} — Frequencia {val?.toFixed?.(1) ?? val} {'>'} {thr}</> };
    case 'high_cpa':
      return { emoji: '⏸️', tone: 'critical', text: <>Pausei {name} — CPA R$ {val?.toFixed?.(2) ?? val} acima do limite de R$ {thr}</> };
    case 'low_ctr':
      return { emoji: '⚠️', tone: 'info', text: <>CTR de {name} em {val?.toFixed?.(2) ?? val}% (alerta)</> };
    case 'budget_exhausted':
      return { emoji: '⚠️', tone: 'info', text: <>Orçamento de {name} consumido em {val?.toFixed?.(0) ?? val}% antes das 18h</> };
    case 'scaling_opportunity':
      return { emoji: '📈', tone: 'success', text: <>Sugiro aumentar orçamento de {name} — CPA R$ {val?.toFixed?.(2) ?? val}</> };
    case 'manual_chat':
      return { emoji: '💬', tone: 'info', text: <>{a.action_type === 'pause' ? 'Pausei' : 'Reativei'} {name} via chat</> };
    default:
      return { emoji: '🤖', tone: 'info', text: <>FURY agiu em {name}</> };
  }
}

const TONE_BG: Record<HumanizedAction['tone'], string> = {
  critical: 'bg-red-500/10 border-red-500/20',
  info: 'bg-amber-500/10 border-amber-500/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
};

export function DashFuryTimeline() {
  const { data: actions, isLoading } = useFuryActions();
  const items = (actions ?? []).slice(0, 20);

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Timeline FURY
        </h3>
        <span className="text-[11px] text-muted-foreground">{items.length} ações recentes</span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8">
          <Zap className="w-8 h-8 opacity-40" />
          <p className="text-sm">Nenhuma ação registrada ainda</p>
          <p className="text-xs">O FURY roda a cada hora</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {items.map((a) => {
            const h = humanize(a);
            return (
              <div key={a.id} className={cn('flex items-start gap-3 p-3 rounded-lg border', TONE_BG[h.tone])}>
                <span className="text-xl leading-none">{h.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{h.text}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
