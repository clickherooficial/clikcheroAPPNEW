// Galeria inline de criativos retornados pela tool no chat.
// Spec: ai-creative-generation (task 9.1 — R5.1, R5.2, R5.3, R5.4, R5.5)

import { useState } from 'react';
import { Loader2, Check, Sparkles, Copy, Trash2, AlertTriangle, CheckCircle2, XCircle, RotateCcw, ArrowRight, Rocket } from 'lucide-react';
import { navigateToView } from '@/lib/view-navigation';
import { ToastAction } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useCreatives } from '@/hooks/use-creatives';
import { useApplyCreativePipeline } from '@/hooks/useApplyCreativePipeline';
import { useToast } from '@/hooks/use-toast';
import {
  ASPECT_LABELS,
  PROVIDER_LABELS,
  type Creative,
} from '@/types/creative';
import { CreativeDetailDialog } from './CreativeDetailDialog';
import { supabase } from '@/integrations/supabase/client';

interface InlineCreative {
  id: string;
  signed_url: string;
  format: 'feed_1x1' | 'story_9x16' | 'reels_4x5';
  model_used: 'gemini-2.5-flash-image' | 'gpt-image-1';
  cost_usd?: number;
  is_near_duplicate?: boolean;
  compliance_warning?: boolean;
  status?: 'generated' | 'approved' | 'discarded' | 'published';
}

type LocalStatus = 'generated' | 'approved' | 'discarded';

interface CreativeGalleryInlineProps {
  creatives: InlineCreative[];
  onSendSystemMessage?: (text: string) => void;
}

export function CreativeGalleryInline({ creatives, onSendSystemMessage }: CreativeGalleryInlineProps) {
  const { isReadOnly, approve, discard, iterate, vary } = useCreatives();
  const applyPipeline = useApplyCreativePipeline();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [iteratingId, setIteratingId] = useState<string | null>(null);
  const [iterateInstruction, setIterateInstruction] = useState('');
  const [detailCreative, setDetailCreative] = useState<Creative | null>(null);
  // Status local que sobrepoe o do servidor — atualiza imediatamente apos action
  const [localStatus, setLocalStatus] = useState<Record<string, LocalStatus>>({});

  if (!creatives || creatives.length === 0) return null;

  const getStatus = (c: InlineCreative): LocalStatus => {
    if (localStatus[c.id]) return localStatus[c.id];
    if (c.status === 'approved' || c.status === 'published') return 'approved';
    if (c.status === 'discarded') return 'discarded';
    return 'generated';
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    const r = await approve(id);
    setBusyId(null);
    if (r.ok) {
      setLocalStatus((prev) => ({ ...prev, [id]: 'approved' }));
      toast({
        title: 'Criativo aprovado',
        description: 'Disponivel em Criativos > Da IA.',
        action: (
          <ToastAction altText="Ver em Criativos" onClick={() => navigateToView('criativos', { criativosTab: 'ia' })}>
            Ver
          </ToastAction>
        ),
      });
      // Fase 6: aplica pipeline_rules ativos (logos/watermarks) em background
      applyPipeline
        .mutateAsync({ creative_id: id, target_table: 'creatives_generated' })
        .then((res) => {
          if (res.applied_rule_ids && res.applied_rule_ids.length > 0) {
            toast({
              title: 'Pipeline aplicado',
              description: `${res.applied_rule_ids.length} regra(s) aplicada(s) ao criativo.`,
            });
          }
        })
        .catch((err) => {
          // Erro silencioso — pipeline e best-effort. Logamos no console.
          console.warn('[apply-pipeline] failed (non-blocking):', err);
        });
    } else {
      toast({ title: 'Erro ao aprovar', description: r.error?.message ?? r.error?.kind, variant: 'destructive' });
    }
  };

  const handleDiscard = async (id: string) => {
    setBusyId(id);
    const r = await discard(id);
    setBusyId(null);
    if (r.ok) {
      setLocalStatus((prev) => ({ ...prev, [id]: 'discarded' }));
      toast({ title: 'Criativo descartado' });
    } else {
      toast({ title: 'Erro', description: r.error?.kind ?? 'falhou', variant: 'destructive' });
    }
  };

  const handleVary = async (id: string) => {
    setBusyId(id);
    const r = await vary(id);
    setBusyId(null);
    toast(r.ok
      ? { title: 'Variações geradas', description: `${r.value.creatives.length} novas.` }
      : { title: 'Erro', description: r.error.kind, variant: 'destructive' });
  };

  const handleReopen = (id: string) => {
    setLocalStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const openDetail = async (id: string) => {
    const { data } = await supabase
      .from('creatives_generated' as never)
      .select('*')
      .eq('id', id)
      .single();
    if (data) {
      const row = data as unknown as Creative;
      const { data: signed } = await supabase.storage
        .from('generated-creatives').createSignedUrl(row.storage_path, 3600);
      setDetailCreative({ ...row, signed_url: signed?.signedUrl });
    }
  };

  const submitIterate = async (parentId: string) => {
    if (!iterateInstruction.trim()) return;
    setBusyId(parentId);
    const r = await iterate({
      parent_creative_id: parentId,
      instruction: iterateInstruction.trim(),
      mode: 'iterate',
    });
    setBusyId(null);
    if (r.ok) {
      toast({ title: 'Iterado', description: `${r.value.creatives.length} novo(s) criativo(s).` });
      setIteratingId(null);
      setIterateInstruction('');
    } else {
      toast({ title: 'Erro', description: r.error.kind, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-3">
        {creatives.map((c) => {
          const aspect = ASPECT_LABELS[c.format];
          const aspectClass = c.format === 'feed_1x1' ? 'aspect-square'
            : c.format === 'story_9x16' ? 'aspect-[9/16]'
            : 'aspect-[4/5]';
          const isBusy = busyId === c.id;
          const status = getStatus(c);
          const isApproved = status === 'approved';
          const isDiscarded = status === 'discarded';
          const cardBorder = isApproved ? 'border-emerald-500/40' : isDiscarded ? 'border-muted-foreground/20 opacity-60' : 'border-border';

          return (
            <div key={c.id} className={`rounded-xl border ${cardBorder} bg-card/50 overflow-hidden flex flex-col transition-all`}>
              <button
                type="button"
                onClick={() => openDetail(c.id)}
                className={`${aspectClass} bg-muted/40 overflow-hidden relative group`}
              >
                <img
                  src={c.signed_url}
                  alt="criativo"
                  className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${isDiscarded ? 'grayscale' : ''}`}
                />
                {c.compliance_warning && (
                  <Badge
                    variant="destructive"
                    className="absolute top-1 left-1 gap-1 cursor-pointer hover:opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToView('compliance');
                    }}
                    title="Atenção: este criativo tem aviso de compliance. Click para ver detalhes."
                  >
                    <AlertTriangle className="h-3 w-3" /> Compliance
                  </Badge>
                )}
                {isApproved && (
                  <div className="absolute top-1 right-1">
                    <Badge variant="default" className="bg-emerald-500/90 text-white gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Aprovado
                    </Badge>
                  </div>
                )}
                {isDiscarded && (
                  <div className="absolute top-1 right-1">
                    <Badge variant="outline" className="bg-background/80 gap-1">
                      <XCircle className="h-3 w-3" /> Descartado
                    </Badge>
                  </div>
                )}
              </button>

              <div className="p-2 space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{aspect.ratio}</Badge>
                  <Badge variant="outline" className="text-[10px]">{PROVIDER_LABELS[c.model_used]}</Badge>
                  {c.is_near_duplicate && <Badge variant="outline" className="text-[10px]">~dup</Badge>}
                </div>

                {(isApproved || isDiscarded) ? (
                  <div className="grid grid-cols-1 gap-1">
                    {isApproved && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            // Dispara fluxo autonomo via chat: LLM detecta e chama propose_campaign.
                            // Se onSendSystemMessage nao foi passado (uso fora do chat), fallback pra view manual.
                            if (onSendSystemMessage) {
                              onSendSystemMessage(`[SISTEMA] Usuario clicou Publicar no criativo ${c.id}. Inicie o fluxo de publicacao agora — colete oferta + budget e chame propose_campaign com creative_id=${c.id}.`);
                            } else {
                              navigateToView('publisher');
                            }
                          }}
                        >
                          <Rocket className="h-3 w-3 mr-1" /> Publicar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-emerald-500/30"
                          onClick={() => navigateToView('criativos', { criativosTab: 'ia' })}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" /> Ver em Criativos
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => handleReopen(c.id)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                    </Button>
                  </div>
                ) : iteratingId === c.id ? (
                  <div className="space-y-1">
                    <Textarea
                      value={iterateInstruction}
                      onChange={(e) => setIterateInstruction(e.target.value)}
                      placeholder="Mudança desejada..."
                      rows={2}
                      maxLength={2000}
                      className="text-xs"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs flex-1"
                              onClick={() => submitIterate(c.id)}
                              disabled={isBusy || !iterateInstruction.trim()}>
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enviar'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => { setIteratingId(null); setIterateInstruction(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    <Button size="sm" variant="default" className="h-7 text-[11px]"
                            onClick={() => handleApprove(c.id)}
                            disabled={isReadOnly || isBusy}>
                      {isBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                            onClick={() => setIteratingId(c.id)}
                            disabled={isReadOnly || isBusy}>
                      <Sparkles className="h-3 w-3 mr-1" /> Iterar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                            onClick={() => handleVary(c.id)}
                            disabled={isReadOnly || isBusy}>
                      <Copy className="h-3 w-3 mr-1" /> Variar 3x
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive"
                            onClick={() => handleDiscard(c.id)}
                            disabled={isReadOnly || isBusy}>
                      <Trash2 className="h-3 w-3 mr-1" /> Descartar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreativeDetailDialog
        creative={detailCreative}
        open={!!detailCreative}
        onOpenChange={(o) => !o && setDetailCreative(null)}
      />
    </>
  );
}
