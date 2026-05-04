import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTakedownHistory, useReactivateAd } from '@/hooks/use-compliance';
import { Loader2, Play, PauseCircle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_STYLES: Record<string, { label: string; className: string; Icon: typeof PauseCircle }> = {
  auto_paused: { label: 'Pausado auto', className: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: PauseCircle },
  manual_paused: { label: 'Pausado manual', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30', Icon: PauseCircle },
  appealed: { label: 'Apelado', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: RotateCcw },
  reactivated: { label: 'Reativado', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: CheckCircle2 },
};

export function TakedownHistory() {
  const { data: actions, isLoading, error } = useTakedownHistory();
  const reactivate = useReactivateAd();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-red-400 text-sm">
          Erro: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Nenhuma ação de takedown registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Anúncio</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => {
            const style = ACTION_STYLES[action.action_type] ?? ACTION_STYLES.auto_paused;
            const isPaused = action.action_type === 'auto_paused' || action.action_type === 'manual_paused';

            return (
              <TableRow key={action.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {action.creative_image_url ? (
                      <img src={action.creative_image_url} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted" />
                    )}
                    <div>
                      <div className="text-sm font-medium truncate max-w-[150px]">
                        {action.creative_name ?? 'Anúncio'}
                      </div>
                      <div className="text-xs text-muted-foreground">{action.external_ad_id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`${style.className} border`}>
                    <style.Icon className="w-3 h-3 mr-1" />
                    {style.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {action.score_final != null ? `${action.score_final}/100` : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {action.reason ?? '—'}
                </TableCell>
                <TableCell>
                  {isPaused && action.external_ad_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reactivate.mutate({ adId: action.external_ad_id! })}
                      disabled={reactivate.isPending}
                      title="Reativar anúncio"
                    >
                      {reactivate.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 text-emerald-400" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
