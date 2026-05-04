// ab-testing (Sprint 7/8) — card side-by-side de A/B test.
import { Trophy, Equal, HelpCircle, Loader2, Play, StopCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEvaluateABTest, useEndABTest } from '@/hooks/use-ab-tests';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ABTest } from '@/types/ab-tests';

const CRITERION_LABEL: Record<ABTest['criterion'], string> = {
  ctr: 'CTR (cliques/impressões)',
  cpl: 'CPL (gasto/conversão)',
  roas: 'ROAS (receita/gasto)',
  conversions: 'Total de conversões',
  spend_efficiency: 'Conversão por R$',
};

interface Props { test: ABTest; }

export function ABTestCard({ test }: Props) {
  const evaluate = useEvaluateABTest();
  const end = useEndABTest();
  const { toast } = useToast();
  const summary = test.evaluation_summary;
  const winner = test.winner_variant;

  const handleEvaluate = () => {
    evaluate.mutate(test.id, {
      onSuccess: (data: any) => {
        toast({ title: 'Avaliado', description: data?.summary?.notes ?? 'OK' });
      },
      onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
    });
  };

  const handleEnd = () => {
    end.mutate(test.id, { onSuccess: () => toast({ title: 'Teste encerrado' }) });
  };

  const winnerIcon = winner === 'tied'
    ? <Equal className="h-4 w-4" />
    : winner === 'inconclusive'
      ? <HelpCircle className="h-4 w-4" />
      : winner === 'a' || winner === 'b'
        ? <Trophy className="h-4 w-4 text-amber-400" />
        : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{test.name}</span>
            {winner && (
              <Badge variant="outline" className="gap-1">
                {winnerIcon}
                {winner === 'a' && 'A vence'}
                {winner === 'b' && 'B vence'}
                {winner === 'tied' && 'Empate'}
                {winner === 'inconclusive' && 'Inconclusivo'}
              </Badge>
            )}
            {test.ended_at && <Badge variant="secondary" className="text-[10px]">Encerrado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Critério: {CRITERION_LABEL[test.criterion]} · iniciado {new Date(test.started_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!test.ended_at && (
            <>
              <Button size="sm" variant="outline" onClick={handleEvaluate} disabled={evaluate.isPending} className="gap-1">
                {evaluate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Avaliar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEnd} className="gap-1">
                <StopCircle className="h-3 w-3" />
                Encerrar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          'rounded-md border p-3 space-y-1',
          winner === 'a' && 'border-amber-500/40 bg-amber-500/5',
        )}>
          <div className="text-xs font-medium">A: {test.variant_a_label ?? test.variant_a_external_id}</div>
          <div className="text-[10px] text-muted-foreground">{test.variant_a_kind} · {test.variant_a_external_id}</div>
          {summary && (
            <div className="space-y-0.5 mt-2 text-xs font-mono">
              <div>Rate: {summary.variant_a.rate.toFixed(4)}</div>
              <div className="text-muted-foreground">Impr: {summary.variant_a.metrics.impressions} · Cliques: {summary.variant_a.metrics.clicks} · Conv: {summary.variant_a.metrics.conversions}</div>
              <div className="text-muted-foreground">Gasto: R${summary.variant_a.metrics.spend.toFixed(2)}</div>
            </div>
          )}
        </div>
        <div className={cn(
          'rounded-md border p-3 space-y-1',
          winner === 'b' && 'border-amber-500/40 bg-amber-500/5',
        )}>
          <div className="text-xs font-medium">B: {test.variant_b_label ?? test.variant_b_external_id}</div>
          <div className="text-[10px] text-muted-foreground">{test.variant_b_kind} · {test.variant_b_external_id}</div>
          {summary && (
            <div className="space-y-0.5 mt-2 text-xs font-mono">
              <div>Rate: {summary.variant_b.rate.toFixed(4)}</div>
              <div className="text-muted-foreground">Impr: {summary.variant_b.metrics.impressions} · Cliques: {summary.variant_b.metrics.clicks} · Conv: {summary.variant_b.metrics.conversions}</div>
              <div className="text-muted-foreground">Gasto: R${summary.variant_b.metrics.spend.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {summary?.notes && (
        <p className="text-xs text-muted-foreground italic">{summary.notes}</p>
      )}
      {test.notes && <p className="text-xs">{test.notes}</p>}
    </Card>
  );
}
