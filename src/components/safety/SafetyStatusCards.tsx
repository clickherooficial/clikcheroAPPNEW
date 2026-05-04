/**
 * 4 cards no topo da SafetyView resumindo o estado atual.
 */
import { Activity, AlertTriangle, FlaskConical, Shield, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SafetyStatus } from '@/types/safety';

interface Props {
  status: SafetyStatus | null;
  isLoading?: boolean;
}

export function SafetyStatusCards({ status, isLoading }: Props) {
  if (isLoading || !status) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24 p-4" />
          </Card>
        ))}
      </div>
    );
  }

  const cfg = status.config;
  const isPaused = status.is_paused;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatusCard
        title="Auto-execucao"
        value={cfg.auto_execute_enabled ? 'Ligada' : 'Desligada'}
        helper={cfg.auto_execute_enabled ? 'Agente pode agir sozinho' : 'Tudo via aprovacao manual'}
        icon={Zap}
        tone={cfg.auto_execute_enabled ? 'positive' : 'neutral'}
      />
      <StatusCard
        title="Modo simulacao"
        value={cfg.sandbox_mode ? 'Ligado' : 'Desligado'}
        helper={
          cfg.sandbox_mode
            ? 'Acoes nao chamam Meta — so logam'
            : 'Acoes mexem no Meta de verdade'
        }
        icon={FlaskConical}
        tone={cfg.sandbox_mode ? 'positive' : 'warning'}
      />
      <StatusCard
        title="Acoes recentes"
        value={`${status.actions_last_1h} / 1h`}
        helper={`${status.actions_last_24h} nas ultimas 24h`}
        icon={Activity}
        tone={
          status.actions_last_1h >= cfg.max_actions_per_hour * 0.8 ? 'warning' : 'neutral'
        }
      />
      <StatusCard
        title={isPaused ? 'Pausado' : 'Ativo'}
        value={isPaused ? 'Bloqueado' : 'OK'}
        helper={
          isPaused && status.paused_reason
            ? status.paused_reason
            : `${status.consecutive_failures} falhas recentes`
        }
        icon={isPaused ? AlertTriangle : Shield}
        tone={isPaused ? 'critical' : 'positive'}
      />
    </div>
  );
}

interface StatusCardProps {
  title: string;
  value: string;
  helper: string;
  icon: React.ElementType;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
}

function StatusCard({ title, value, helper, icon: Icon, tone }: StatusCardProps) {
  const toneStyles: Record<StatusCardProps['tone'], string> = {
    positive: 'border-emerald-500/30 bg-emerald-500/5',
    neutral: 'border-border bg-card',
    warning: 'border-amber-500/30 bg-amber-500/5',
    critical: 'border-red-500/40 bg-red-500/10',
  };

  const iconStyles: Record<StatusCardProps['tone'], string> = {
    positive: 'text-emerald-500',
    neutral: 'text-muted-foreground',
    warning: 'text-amber-500',
    critical: 'text-red-500',
  };

  return (
    <Card className={cn('border', toneStyles[tone])}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          <Icon className={cn('h-4 w-4', iconStyles[tone])} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground line-clamp-2">{helper}</div>
      </CardContent>
    </Card>
  );
}
