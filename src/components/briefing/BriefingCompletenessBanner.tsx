// Banner persistente de completude do briefing (R1.6, R8.1, R8.3).
// Spec: briefing-onboarding (task 8.1)

import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useBriefingCompleteness } from '@/hooks/use-briefing-completeness';
import { BRIEFING_MISSING_FIELD_LABELS } from '@/types/briefing';

export function BriefingCompletenessBanner() {
  const navigate = useNavigate();
  const { isComplete, missingFields, score, isLoading, status } = useBriefingCompleteness();

  if (isLoading || isComplete) return null;
  if (status === 'not_started' && missingFields.length === 0) {
    // Sem briefing iniciado — banner mostra CTA pra comecar.
    return (
      <Alert className="rounded-none border-x-0 border-t-0">
        <Sparkles className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between w-full gap-3">
          <span>
            <strong>Briefing não iniciado.</strong> Complete seu perfil de negocio — leva cerca de 5 minutos.
          </span>
          <Button size="sm" onClick={() => navigate('/briefing/wizard')}>
            Comecar agora
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const missingLabels = missingFields
    .slice(0, 3)
    .map((f) => BRIEFING_MISSING_FIELD_LABELS[f] ?? f)
    .join(', ');
  const moreCount = Math.max(0, missingFields.length - 3);

  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <Sparkles className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full gap-3">
        <span>
          <strong>Briefing {score}% completo.</strong> Falta: {missingLabels}
          {moreCount > 0 ? ` e mais ${moreCount}` : ''}. Geração de criativos e públicação de
          campanhas ficam bloqueadas ate completar.
        </span>
        <Button size="sm" variant="outline" onClick={() => navigate('/briefing')}>
          Completar briefing
        </Button>
      </AlertDescription>
    </Alert>
  );
}
