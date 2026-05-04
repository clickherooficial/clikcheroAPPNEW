/**
 * View "Seguranca do Agente" — composicao das cartas + form + ledger.
 * Sprint 1/8 — agent-safety-rails.
 */
import { Shield } from 'lucide-react';
import { useSafetyStatus } from '@/hooks/use-safety';
import { ActionLedgerTable } from '@/components/safety/ActionLedgerTable';
import { CircuitBreakerBanner } from '@/components/safety/CircuitBreakerBanner';
import { SafetyConfigForm } from '@/components/safety/SafetyConfigForm';
import { SafetyStatusCards } from '@/components/safety/SafetyStatusCards';

const SafetyView = () => {
  const { data: status, isLoading } = useSafetyStatus();

  return (
    <div className="animate-fade-in space-y-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Seguranca do Agente</h1>
          <p className="text-sm text-muted-foreground">
            Configure os trilhos de seguranca antes de liberar acoes autonomas no Meta Ads.
          </p>
        </div>
      </header>

      {status && <CircuitBreakerBanner status={status} />}

      <SafetyStatusCards status={status ?? null} isLoading={isLoading} />

      {status?.config && <SafetyConfigForm config={status.config} />}

      <ActionLedgerTable />
    </div>
  );
};

export default SafetyView;
