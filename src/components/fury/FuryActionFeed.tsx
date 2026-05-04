import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFuryActions, useFuryRevert, type FuryAction } from '@/hooks/use-fury';
import { Loader2, PauseCircle, AlertTriangle, TrendingUp, RotateCcw, Undo2, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_STYLES: Record<string, { label: string; className: string; Icon: typeof PauseCircle }> = {
  pause: { label: 'Pausar', className: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: PauseCircle },
  alert: { label: 'Alerta', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: AlertTriangle },
  suggest: { label: 'Sugestão', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', Icon: TrendingUp },
  revert: { label: 'Revertido', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: RotateCcw },
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400',
  executed: 'bg-red-500/10 text-red-400',
  reverted: 'bg-emerald-500/10 text-emerald-400',
  expired: 'bg-gray-500/10 text-gray-400',
};

function canRevert(action: FuryAction): boolean {
  if (action.status !== 'executed') return false;
  if (!action.revert_before) return false;
  return new Date(action.revert_before).getTime() > Date.now();
}

function ActionCard({ action }: { action: FuryAction }) {
  const revert = useFuryRevert();
  const style = ACTION_STYLES[action.action_type] ?? ACTION_STYLES.alert;
  const Icon = style.Icon;

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
      <div className={`p-2 rounded-lg ${style.className}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{action.campaign_name ?? 'Campanha'}</span>
          <Badge variant="outline" className={`text-xs ${STATUS_STYLES[action.status] ?? ''}`}>
            {action.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-1">
          Regra: <strong>{action.rule_display_name ?? action.rule_key}</strong>
        </p>
        {action.metric_value != null && (
          <p className="text-xs text-muted-foreground">
            {action.metric_name}: <strong>{action.metric_value}</strong> (threshold: {action.threshold_value})
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: ptBR })}
          {canRevert(action) && (
            <span className="text-amber-400 ml-2">
              (reversivel por mais {Math.ceil((new Date(action.revert_before!).getTime() - Date.now()) / 60_000)} min)
            </span>
          )}
        </p>
      </div>
      {canRevert(action) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => revert.mutate(action.id)}
          disabled={revert.isPending}
          className="shrink-0"
        >
          {revert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4 mr-1" />}
          Desfazer
        </Button>
      )}
    </div>
  );
}

export function FuryActionFeed() {
  const [filter, setFilter] = useState('all');
  const { data: actions, isLoading, error } = useFuryActions(filter);

  if (isLoading) {
    return <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (error) {
    return <Card><CardContent className="p-6 text-red-400 text-sm">Erro: {(error as Error).message}</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ações recentes</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="executed">Executados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="reverted">Revertidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!actions || actions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma ação ainda</h3>
            <p className="text-sm text-muted-foreground">O FURY avalia campanhas automaticamente a cada hora. Clique "Avaliar Agora" para rodar manualmente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
