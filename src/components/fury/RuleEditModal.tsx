// Modal de edicao da regra antes de salvar.
// Spec: .kiro/specs/fury-learning/ (T4.2)

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAcceptRuleProposal } from '@/hooks/useRuleProposal';
import { RULE_TYPE_LABELS, type ProposedRuleEnvelope } from '@/types/fury-rules';

interface Props {
  open: boolean;
  envelope: ProposedRuleEnvelope;
  messageId: string;
  onClose: () => void;
}

export function RuleEditModal({ open, envelope, messageId, onClose }: Props) {
  const accept = useAcceptRuleProposal();
  const { toast } = useToast();
  const [name, setName] = useState(envelope.proposed_rule.name);
  const [description, setDescription] = useState(envelope.proposed_rule.description);

  const onSave = async () => {
    try {
      await accept.mutateAsync({
        messageId,
        proposed: { ...envelope.proposed_rule, name, description },
        edited: true,
      });
      toast({ title: 'Regra ativa (editada)' });
      onClose();
    } catch (e) {
      toast({ title: 'Falha ao salvar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {RULE_TYPE_LABELS[envelope.rule_type].toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rule-name">Nome</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="rule-desc">Descrição</Label>
            <Textarea
              id="rule-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={accept.isPending}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={accept.isPending || !name.trim() || !description.trim()}>
            {accept.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
