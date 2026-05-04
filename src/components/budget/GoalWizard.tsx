import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { ObjectiveStep } from './ObjectiveStep';
import { GoalInputStep } from './GoalInputStep';
import { BudgetSliderStep } from './BudgetSliderStep';
import { RecommendationCard } from './RecommendationCard';
import { useBudgetRecommend, type BudgetRecommendation } from '@/hooks/use-budget-smart';

const STEPS = [
  { key: 'objective', label: 'Objetivo' },
  { key: 'goal', label: 'Meta' },
  { key: 'budget', label: 'Orçamento' },
];

export function GoalWizard() {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<string>('OUTCOME_LEADS');
  const [goalPerWeek, setGoalPerWeek] = useState(100);
  const [budget, setBudget] = useState(700); // R$/semana
  const [recommendation, setRecommendation] = useState<BudgetRecommendation | null>(null);

  const recommend = useBudgetRecommend();

  const handleGenerate = async () => {
    const rec = await recommend.mutateAsync({
      objective,
      goal_per_week: goalPerWeek,
      current_budget_weekly: budget,
    });
    setRecommendation(rec);
  };

  const canNext = () => {
    if (step === 0) return !!objective;
    if (step === 1) return goalPerWeek > 0;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2',
              i < step ? 'bg-emerald-500 border-emerald-500 text-white'
                : i === step ? 'bg-primary border-primary text-white'
                  : 'border-muted text-muted-foreground'
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-sm font-medium', i === step ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className={cn('flex-1 h-0.5', i < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && <ObjectiveStep value={objective} onChange={setObjective} />}
          {step === 1 && <GoalInputStep objective={objective} value={goalPerWeek} onChange={setGoalPerWeek} />}
          {step === 2 && (
            <BudgetSliderStep
              objective={objective}
              goalPerWeek={goalPerWeek}
              budget={budget}
              onBudgetChange={setBudget}
              onGenerate={handleGenerate}
              isGenerating={recommend.isPending}
            />
          )}
        </CardContent>
      </Card>

      {step === 2 && recommendation && (
        <RecommendationCard recommendation={recommendation} objective={objective} />
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0 || recommend.isPending}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        {step < STEPS.length - 1 && (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
