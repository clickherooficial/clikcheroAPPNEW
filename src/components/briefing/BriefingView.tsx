// Pagina de edicao continua do briefing. Spec: briefing-onboarding (task 7.1, 7.2)

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBriefing } from '@/hooks/use-briefing';
import { useBriefingCompleteness } from '@/hooks/use-briefing-completeness';
import { StepBusiness } from './steps/StepBusiness';
import { StepOffers } from './steps/StepOffers';
import { StepAudience } from './steps/StepAudience';
import { StepTone } from './steps/StepTone';
import { StepVisuals } from './steps/StepVisuals';
import { StepProhibitions } from './steps/StepProhibitions';
import { Progress } from '@/components/ui/progress';
import { ArchetypeSelector } from './ArchetypeSelector';
import { BRIEFING_MISSING_FIELD_LABELS, type BriefingMissingField } from '@/types/briefing';

function formatMissingRequiredSummary(count: number, fields: BriefingMissingField[]): string {
  if (fields.length === 0) return '';
  const labels = fields.map((f) => BRIEFING_MISSING_FIELD_LABELS[f] ?? f);
  const listed = labels.join(', ');
  const suffix = count === 1 ? 'Falta 1 campo obrigatório' : `Faltam ${count} campos obrigatórios`;
  return `${suffix}: ${listed}`;
}

export function BriefingView() {
  const { briefing, isLoading, isReadOnly, saveStep } = useBriefing();
  const completeness = useBriefingCompleteness();
  const { toast } = useToast();

  const handleSave = async (
    step: 1 | 3 | 4 | 5,
    data: Record<string, unknown>,
    label: string,
  ) => {
    const result = await saveStep(step, data);
    if (!result.ok) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Salvo', description: label });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Briefing da empresa</CardTitle>
          <CardDescription>
            Edite a qualquer momento; use Salvar em cada seção para atualizar o briefing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Completude</span>
            <span className="text-sm font-medium">{completeness.score}%</span>
          </div>
          <Progress value={completeness.score} />
          {!completeness.isComplete && (
            <Alert className="mt-3">
              <AlertDescription>
                {completeness.missingFields.length > 0 ? (
                  <>
                    Briefing ainda incompleto.{' '}
                    {formatMissingRequiredSummary(
                      completeness.missingFields.length,
                      completeness.missingFields,
                    )}
                    .
                  </>
                ) : (
                  <>
                    Briefing ainda incompleto. Alguns dados obrigatórios não foram marcados como
                    concluídos — abra cada seção abaixo e salve onde faltar informação.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
          {isReadOnly && (
            <Alert className="mt-3" variant="default">
              <AlertDescription>
                Você esta em modo somente leitura. Apenas owner/admin podem editar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <ArchetypeSelector />

      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="business" className="border rounded-md px-4">
          <AccordionTrigger>1 — Negocio</AccordionTrigger>
          <AccordionContent>
            <StepBusiness
              initial={briefing}
              disabled={isReadOnly}
              mode="settings"
              onSubmit={(data) => handleSave(1, data, 'Dados do negocio atualizados')}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="offers" className="border rounded-md px-4">
          <AccordionTrigger>2 — Ofertas</AccordionTrigger>
          <AccordionContent>
            <StepOffers disabled={isReadOnly} mode="settings" onContinue={() => undefined} onBack={() => undefined} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audience" className="border rounded-md px-4">
          <AccordionTrigger>3 — Cliente ideal (ICP)</AccordionTrigger>
          <AccordionContent>
            <StepAudience
              initial={briefing?.audience ?? {}}
              disabled={isReadOnly}
              mode="settings"
              onSubmit={(audience) => handleSave(3, { audience }, 'Audiência atualizada')}
              onBack={() => undefined}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tone" className="border rounded-md px-4">
          <AccordionTrigger>4 — Tom de voz da sua marca</AccordionTrigger>
          <AccordionContent>
            <StepTone
              initial={briefing?.tone ?? {}}
              disabled={isReadOnly}
              mode="settings"
              onSubmit={(tone) => handleSave(4, { tone }, 'Tom de voz atualizado')}
              onBack={() => undefined}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="visual" className="border rounded-md px-4">
          <AccordionTrigger>5 — Identidade visual</AccordionTrigger>
          <AccordionContent>
            <StepVisuals
              initial={briefing?.palette ?? {}}
              disabled={isReadOnly}
              mode="settings"
              onSubmit={(palette) => handleSave(5, { palette }, 'Identidade visual atualizada')}
              onBack={() => undefined}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="prohibitions" className="border rounded-md px-4">
          <AccordionTrigger>6 — O que Não usar (proibições)</AccordionTrigger>
          <AccordionContent>
            <StepProhibitions
              niche={briefing?.niche ?? null}
              disabled={isReadOnly}
              mode="settings"
              onComplete={() => undefined}
              onBack={() => undefined}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
