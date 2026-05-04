// Tab: regras de comportamento (preferencias persistidas no system prompt).
// Spec: .kiro/specs/fury-learning/ (T5.3)

import { Sparkles, MessageSquare } from 'lucide-react';
import { useActiveRules } from '@/hooks/useActiveRules';
import { Button } from '@/components/ui/button';
import { RuleListItem } from './RuleListItem';
import { navigateToView } from '@/lib/view-navigation';

export function BehaviorRulesTab() {
  const { behavior, isLoading } = useActiveRules();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando...</div>;
  }
  if (!behavior.length) {
    return (
      <div className="text-center py-12 px-6 border border-dashed rounded-lg space-y-3">
        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Nenhuma regra de comportamento ainda</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Vá ate Meus anúncios e diga ao FURY uma instrucao permanente. Ex:
            <span className="block mt-1 italic text-foreground/80">"Sempre responda em português formal"</span>
            <span className="block italic text-foreground/80">"Nunca use a palavra 'garantido'"</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigateToView('chat')}>
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          Ir para Meus anúncios
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {behavior.length} regra{behavior.length === 1 ? '' : 's'} de comportamento
      </div>
      {behavior.map((rule) => (
        <RuleListItem
          key={rule.id}
          table="behavior_rules"
          id={rule.id}
          name={rule.name}
          description={rule.description}
          is_enabled={rule.is_enabled}
          origin={rule.proposal_status === 'manual' ? 'manual' : 'chat'}
          confidence={rule.confidence}
        />
      ))}
    </div>
  );
}
