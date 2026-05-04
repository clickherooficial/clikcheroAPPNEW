import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useResetCircuitBreaker } from '@/hooks/use-safety';
import type { SafetyStatus } from '@/types/safety';

interface Props {
  status: SafetyStatus;
}

export function CircuitBreakerBanner({ status }: Props) {
  const reset = useResetCircuitBreaker();

  if (!status.is_paused) return null;

  const pausedUntil = status.paused_until ? new Date(status.paused_until) : null;
  const minutesLeft = pausedUntil
    ? Math.max(0, Math.ceil((pausedUntil.getTime() - Date.now()) / 60000))
    : 0;

  return (
    <Alert variant="destructive" className="border-red-500/40 bg-red-500/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Agente pausado</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{status.paused_reason ?? 'Agente bloqueado por motivo de seguranca.'}</p>
        {minutesLeft > 0 && (
          <p className="text-xs text-muted-foreground">
            Liberacao automatica em ~{minutesLeft} minuto{minutesLeft === 1 ? '' : 's'}.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {reset.isPending ? 'Resetando...' : 'Resetar agora'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
