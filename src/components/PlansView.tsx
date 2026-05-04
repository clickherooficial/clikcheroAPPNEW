// agent-execution-loop (Sprint 5/8) — View "Planos" (execucao + historico).
import { ListChecks, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { usePlans } from '@/hooks/use-plans';
import { PlanCard } from './plans/PlanCard';

const PlansView = () => {
  const { plans, isLoading, decidingId, executeNow, abort } = usePlans();

  const aprovados = plans.filter((p) => p.status === 'approved' || p.status === 'running');
  const pendentes = plans.filter((p) => p.status === 'pending');
  const finalizados = plans.filter((p) =>
    p.status === 'executed' || p.status === 'partial' || p.status === 'failed' ||
    p.status === 'rejected' || p.status === 'expired' || p.status === 'rolled_back' ||
    p.status === 'aborted',
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Planos</h1>
          <p className="text-xs text-muted-foreground">
            Planos multi-step propostos pela IA. Aprove via Aprovações; execute aqui.
          </p>
        </div>
      </div>

      {isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando planos…</Card>}

      {!isLoading && plans.length === 0 && (
        <Card className="p-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Nenhum plano ainda. Peça pra IA propor um (ex: "limpa a casa: pausa as 3 mortas e aumenta budget das 2 melhores").
          </span>
        </Card>
      )}

      {aprovados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Pronto pra executar / Em execução
          </h2>
          {aprovados.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              busy={decidingId === p.id}
              onExecute={executeNow}
              onAbort={abort}
            />
          ))}
        </section>
      )}

      {pendentes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Aguardando aprovação
          </h2>
          {pendentes.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              busy={false}
              onExecute={executeNow}
              onAbort={abort}
            />
          ))}
        </section>
      )}

      {finalizados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Histórico
          </h2>
          {finalizados.slice(0, 20).map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              busy={false}
              onExecute={executeNow}
              onAbort={abort}
            />
          ))}
        </section>
      )}
    </div>
  );
};

export default PlansView;
