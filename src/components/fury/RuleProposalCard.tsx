// Card inline de proposta de regra (renderizado abaixo da assistant message).
// Spec: .kiro/specs/fury-learning/ (T4.1)

import { useEffect, useState } from 'react';
import { Check, X, Pencil, Sparkles, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAcceptRuleProposal, useRejectRuleProposal } from '@/hooks/useRuleProposal';
import { RULE_TYPE_LABELS, type ProposedRuleEnvelope } from '@/types/fury-rules';
import { RuleEditModal } from './RuleEditModal';
import { navigateToView, type CerebroRulesSubTab } from '@/lib/view-navigation';

function ruleSubTabFor(ruleType: string): CerebroRulesSubTab {
  if (ruleType === 'behavior') return 'comportamento';
  if (ruleType === 'creative_pipeline') return 'pipeline';
  if (ruleType === 'action') return 'acoes';
  return 'todas';
}

interface Props {
  messageId: string;
  envelope: ProposedRuleEnvelope;
}

type LocalState = 'pending' | 'accepted' | 'rejected' | 'dismissed';

export function RuleProposalCard({ messageId, envelope }: Props) {
  const accept = useAcceptRuleProposal();
  const reject = useRejectRuleProposal();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [localState, setLocalState] = useState<LocalState>(envelope.status === 'pending' ? 'pending' : envelope.status);

  // Apos accepted/rejected, some completamente em 3.5s
  useEffect(() => {
    if (localState === 'accepted' || localState === 'rejected') {
      const t = setTimeout(() => setLocalState('dismissed'), 3500);
      return () => clearTimeout(t);
    }
  }, [localState]);

  if (envelope.status !== 'pending' && localState === 'pending') return null;
  if (localState === 'dismissed') return null;
  const proposed = envelope.proposed_rule;

  const onAccept = async () => {
    try {
      await accept.mutateAsync({ messageId, proposed });
      setLocalState('accepted');
      toast({ title: 'Regra salva', description: proposed.name });
    } catch (e) {
      toast({ title: 'Falha ao salvar regra', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync({
        messageId,
        ruleType: envelope.rule_type,
        confidence: envelope.confidence,
      });
      setLocalState('rejected');
      toast({ title: 'Proposta descartada' });
    } catch (e) {
      toast({ title: 'Falha ao descartar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const confidencePct = Math.round((envelope.confidence ?? 0) * 100);

  // Estado pos-decisao: mostra confirmacao discreta por 2.5s, depois esconde
  if (localState === 'accepted') {
    return (
      <div className="max-w-3xl mx-auto w-full my-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3 animate-fade-in">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <div className="text-sm flex-1 min-w-0">
          <span className="text-foreground font-medium">Regra ativa: </span>
          <span className="text-muted-foreground truncate">{proposed.name}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => navigateToView('cerebro', {
            cerebroTab: 'regras',
            cerebroRulesSubTab: ruleSubTabFor(envelope.rule_type),
          })}
        >
          Ver em Configuracoes <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  if (localState === 'rejected') {
    return (
      <div className="max-w-3xl mx-auto w-full my-2 p-3 rounded-xl border border-muted-foreground/20 bg-muted/30 flex items-center gap-3 animate-fade-in">
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          Proposta descartada: {proposed.name}
        </div>
      </div>
    );
  }

  const busy = accept.isPending || reject.isPending;

  return (
    <div className="max-w-3xl mx-auto w-full my-2 p-4 rounded-xl border border-violet-500/30 bg-violet-500/5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center text-violet-400 shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Nova regra detectada</span>
            <Badge variant="secondary">{RULE_TYPE_LABELS[envelope.rule_type]}</Badge>
            <Badge variant="outline">{confidencePct}% confianca</Badge>
          </div>
          <div className="text-sm font-medium text-foreground">{proposed.name}</div>
          <div className="text-sm text-muted-foreground">{proposed.description}</div>
          {proposed.reasoning && (
            <div className="text-xs text-muted-foreground/70 italic">{proposed.reasoning}</div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onAccept} disabled={busy}>
              {accept.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Salvar regra
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={busy}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={onReject} disabled={busy}>
              {reject.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
              Descartar
            </Button>
          </div>
        </div>
      </div>

      <RuleEditModal
        open={editOpen}
        envelope={envelope}
        messageId={messageId}
        onClose={() => {
          setEditOpen(false);
          // Se o modal salvou, marca como accepted localmente
          if (accept.isSuccess) setLocalState('accepted');
        }}
      />
    </div>
  );
}
