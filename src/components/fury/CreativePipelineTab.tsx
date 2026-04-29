// Tab: regras de pipeline de criativo (logos, watermarks, fontes...).
// Spec: .kiro/specs/fury-learning/ (T5.3)

import { ImagePlus, MessageSquare } from 'lucide-react';
import { useActiveRules } from '@/hooks/useActiveRules';
import { Button } from '@/components/ui/button';
import { RuleListItem } from './RuleListItem';
import { TRANSFORM_TYPE_LABELS } from '@/types/fury-rules';
import { navigateToView } from '@/lib/view-navigation';

export function CreativePipelineTab() {
  const { pipeline, isLoading } = useActiveRules();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando...</div>;
  }
  if (!pipeline.length) {
    return (
      <div className="text-center py-12 px-6 border border-dashed rounded-lg space-y-3">
        <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Nenhuma regra de pipeline ainda</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Anexe uma imagem (logo, watermark) no chat e diga ao FURY como usar. Ex:
            <span className="block mt-1 italic text-foreground/80">"Use sempre essa logo no canto superior direito"</span>
            <span className="block italic text-foreground/80">"Aplique essa watermark em todos os criativos"</span>
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
        {pipeline.length} regra{pipeline.length === 1 ? '' : 's'} de pipeline
      </div>
      {pipeline.map((rule) => (
        <RuleListItem
          key={rule.id}
          table="creative_pipeline_rules"
          id={rule.id}
          name={rule.name}
          description={rule.description}
          is_enabled={rule.is_enabled}
          origin={rule.proposal_status === 'manual' ? 'manual' : 'chat'}
          confidence={rule.confidence}
          badge={TRANSFORM_TYPE_LABELS[rule.transform_type]}
        />
      ))}
    </div>
  );
}
