// Linha generica de regra (toggle + metadata + delete).
// Spec: .kiro/specs/fury-learning/ (T5.2)

import { Trash2, Sparkles, User, BadgeCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useToggleRule, useDeleteRule, type RuleTable } from '@/hooks/useToggleRule';

interface Props {
  table: RuleTable;
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  origin: 'manual' | 'chat';
  confidence?: number | null;
  badge?: string;
}

export function RuleListItem({ table, id, name, description, is_enabled, origin, confidence, badge }: Props) {
  const toggle = useToggleRule();
  const del = useDeleteRule();
  const { toast } = useToast();

  const onToggle = async (checked: boolean) => {
    try {
      await toggle.mutateAsync({ table, id, is_enabled: checked });
    } catch (e) {
      toast({ title: 'Falha ao atualizar regra', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onDelete = async () => {
    if (!confirm(`Excluir regra "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await del.mutateAsync({ table, id });
      toast({ title: 'Regra excluida' });
    } catch (e) {
      toast({ title: 'Falha ao excluir', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card">
      <Switch checked={is_enabled} onCheckedChange={onToggle} disabled={toggle.isPending} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{name}</span>
          {origin === 'chat' ? (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> Aprendida no chat
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" /> Manual
            </Badge>
          )}
          {typeof confidence === 'number' && (
            <Badge variant="outline" className="gap-1">
              <BadgeCheck className="h-3 w-3" /> {Math.round(confidence * 100)}%
            </Badge>
          )}
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={del.isPending}
        aria-label="Excluir regra"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
