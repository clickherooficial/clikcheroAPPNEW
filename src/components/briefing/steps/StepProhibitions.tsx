// Passo 6 — Proibicoes. Spec: briefing-onboarding (task 6.7)

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useBriefingProhibitions,
  suggestVertical,
} from '@/hooks/use-briefing-prohibitions';
import { TagInput, type TagInputHandle } from '@/components/briefing/TagInput';
import type { ProhibitionCategory } from '@/types/briefing';

interface Props {
  niche: string | null;
  disabled?: boolean;
  mode?: 'wizard' | 'settings';
  onComplete: () => void;
  onBack: () => void;
}

export function StepProhibitions({ niche, disabled, mode = 'wizard', onComplete, onBack }: Props) {
  const { toast } = useToast();
  const { prohibitions, add, remove, seedVerticalDefaults, isLoading } = useBriefingProhibitions();
  const [seeded, setSeeded] = useState(false);

  const vertical = suggestVertical(niche);

  // R5.4: pre-popular sugestoes para vertical regulada
  useEffect(() => {
    if (!vertical || seeded || isLoading) return;
    seedVerticalDefaults(vertical).then((res) => {
      if (res.ok) {
        setSeeded(true);
        if (res.value > 0) {
          toast({
            title: 'Sugestões adicionadas',
            description: `${res.value} proibições recomendadas para sua vertical foram pre-cadastradas. Edite se quiser.`,
          });
        }
      }
    });
  }, [vertical, seeded, isLoading, seedVerticalDefaults, toast]);

  const grouped = {
    word: prohibitions.filter((p) => p.category === 'word'),
    topic: prohibitions.filter((p) => p.category === 'topic'),
    visual: prohibitions.filter((p) => p.category === 'visual'),
  };

  const handleAdd = async (category: ProhibitionCategory, values: string[]) => {
    const existing = grouped[category].map((p) => p.value);
    const novos = values.filter((v) => !existing.includes(v));
    for (const v of novos) {
      await add({ category, value: v });
    }
  };

  const handleRemove = async (id: string, source: string) => {
    if (source === 'vertical_default') {
      const ok = window.confirm(
        'Esta proibição foi recomendada para sua vertical (saúde, financeiro, etc). Remover pode aumentar o risco de violacao da Meta. Continuar?',
      );
      if (!ok) return;
    }
    await remove(id);
  };

  return (
    <div className="space-y-5">
      {vertical && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Vertical regulada detectada</AlertTitle>
          <AlertDescription>
            Pelo seu nicho, recomendamos algumas proibições para reduzir risco de violacao Meta.
            Você pode editar livremente.
          </AlertDescription>
        </Alert>
      )}

      <ProhibitionCategorySection
        title="Palavras proibidas"
        description="Termos que nunca devem aparecer nos seus anúncios"
        items={grouped.word}
        onAdd={(vals) => handleAdd('word', vals)}
        onRemove={(id, src) => handleRemove(id, src)}
        disabled={disabled}
      />

      <ProhibitionCategorySection
        title="Assuntos proibidos"
        description="Temas que devem ficar de fora (ex: comparação com concorrentes)"
        items={grouped.topic}
        onAdd={(vals) => handleAdd('topic', vals)}
        onRemove={(id, src) => handleRemove(id, src)}
        disabled={disabled}
      />

      <ProhibitionCategorySection
        title="Restricoes visuais"
        description="Regras para criativos gerados (ex: não usar fotos de pessoas)"
        items={grouped.visual}
        onAdd={(vals) => handleAdd('visual', vals)}
        onRemove={(id, src) => handleRemove(id, src)}
        disabled={disabled}
      />

      {mode !== 'settings' && (
        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onBack} disabled={disabled}>Voltar</Button>
          <Button onClick={onComplete} disabled={disabled}>Concluir</Button>
        </div>
      )}
      {mode === 'settings' && (
        <p className="pt-2 text-xs text-muted-foreground">
          Cada proibição e salva automaticamente ao adicionar ou remover.
        </p>
      )}
    </div>
  );
}

function ProhibitionCategorySection({
  title,
  description,
  items,
  onAdd,
  onRemove,
  disabled,
}: {
  title: string;
  description: string;
  items: { id: string; value: string; source: string }[];
  onAdd: (values: string[]) => void;
  onRemove: (id: string, source: string) => void;
  disabled?: boolean;
}) {
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const tagRef = useRef<TagInputHandle>(null);

  const flush = () => {
    // Commit any pending text in the input first (e.g., user typed but didn't press Enter)
    tagRef.current?.commit();
    // Functional setter sees the latest queued state, including the commit above
    setDraftValues((current) => {
      if (current.length > 0) onAdd(current);
      return [];
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((p) => (
            <Badge key={p.id} variant={p.source === 'vertical_default' ? 'default' : 'secondary'} className="gap-1">
              {p.value}
              {!disabled && (
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => onRemove(p.id, p.source)}
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <TagInput ref={tagRef} value={draftValues} onChange={setDraftValues} placeholder="Pressione enter ou clique em Adicionar" disabled={disabled} max={20} />
        </div>
        <Button size="sm" variant="outline" onClick={flush} disabled={disabled}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}
