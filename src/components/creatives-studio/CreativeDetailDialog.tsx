// Dialog de detalhe de um criativo: imagem alta-res + tabs (info/linhagem/compliance) + acoes.
// Spec: ai-creative-generation (task 9.4 — R7.2, R7.3, R7.4, R8.4)

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Download, Sparkles, Trash2, AlertTriangle, ShieldCheck, Wand2 } from 'lucide-react';
import { useCreatives } from '@/hooks/use-creatives';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ASPECT_LABELS,
  PROVIDER_LABELS,
  STATUS_LABELS,
  type Creative,
  type CreativeProvenance,
} from '@/types/creative';

interface ComplianceCheck {
  baseline_hits: string[];
  briefing_hits: string[];
  ocr_hits: string[];
  passed: boolean;
}

interface CreativeDetailDialogProps {
  creative: Creative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativeDetailDialog({ creative, open, onOpenChange }: CreativeDetailDialogProps) {
  const { isReadOnly, updateMetadata, discard, iterate } = useCreatives();
  const { toast } = useToast();
  const [provenance, setProvenance] = useState<CreativeProvenance | null>(null);
  const [compliance, setCompliance] = useState<ComplianceCheck | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [readyForPublish, setReadyForPublish] = useState(false);
  const [iterateInstruction, setIterateInstruction] = useState('');
  const [busy, setBusy] = useState<'save' | 'discard' | 'iterate' | null>(null);

  useEffect(() => {
    if (!creative) return;
    setTitle(creative.title ?? '');
    setDescription(creative.description ?? '');
    setTagsInput((creative.tags ?? []).join(', '));
    setReadyForPublish(!!creative.ready_for_publish);
    setIterateInstruction('');
  }, [creative]);

  useEffect(() => {
    if (!open || !creative) {
      setProvenance(null);
      setCompliance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [provRes, compRes] = await Promise.all([
        supabase.rpc('get_creative_provenance' as never, { p_creative_id: creative.id } as never),
        supabase
          .from('creative_compliance_check' as never)
          .select('baseline_hits, briefing_hits, ocr_hits, passed')
          .eq('creative_id', creative.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setProvenance((provRes.data as unknown as CreativeProvenance) ?? null);
      setCompliance((compRes.data as unknown as ComplianceCheck) ?? null);
    })();
    return () => { cancelled = true; };
  }, [open, creative]);

  if (!creative) return null;

  const aspectMeta = ASPECT_LABELS[creative.format];
  const providerLabel = PROVIDER_LABELS[creative.model_used];

  const handleSave = async () => {
    setBusy('save');
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const result = await updateMetadata({
      id: creative.id,
      patch: {
        title: title.trim() || null,
        description: description.trim() || null,
        tags,
        ready_for_publish: readyForPublish,
      },
    });
    setBusy(null);
    toast(result.ok
      ? { title: 'Salvo', description: 'Metadata atualizada.' }
      : { title: 'Erro', description: errMsg(result.error), variant: 'destructive' });
  };

  const handleDiscard = async () => {
    setBusy('discard');
    const result = await discard(creative.id);
    setBusy(null);
    if (result.ok) {
      toast({ title: 'Descartado', description: 'Criativo movido pra descartados.' });
      onOpenChange(false);
    } else {
      toast({ title: 'Erro', description: errMsg(result.error), variant: 'destructive' });
    }
  };

  const handleIterate = async () => {
    if (!iterateInstruction.trim()) return;
    setBusy('iterate');
    const result = await iterate({
      parent_creative_id: creative.id,
      instruction: iterateInstruction.trim(),
      mode: 'iterate',
    });
    setBusy(null);
    if (result.ok) {
      toast({
        title: 'Iteracao concluida',
        description: `${result.value.creatives.length} novo(s) criativo(s).`,
      });
      setIterateInstruction('');
    } else {
      toast({ title: 'Erro', description: errMsg(result.error), variant: 'destructive' });
    }
  };

  const handleDownload = async () => {
    if (!creative.signed_url) return;
    const a = document.createElement('a');
    a.href = creative.signed_url;
    a.download = `${creative.title ?? creative.id}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {creative.title ?? 'Criativo sem titulo'}
            <Badge variant="outline">{STATUS_LABELS[creative.status]}</Badge>
            <Badge variant="secondary">{aspectMeta.label} ({aspectMeta.ratio})</Badge>
            <Badge variant="secondary">{providerLabel}</Badge>
            {creative.compliance_warning && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Compliance
              </Badge>
            )}
            {creative.is_near_duplicate && (
              <Badge variant="outline" className="gap-1">Quase duplicado</Badge>
            )}
            {Array.isArray(creative.pipeline_applied_rules) && creative.pipeline_applied_rules.length > 0 && (
              <Badge variant="secondary" className="gap-1 border-violet-500/40 text-violet-300">
                <Wand2 className="h-3 w-3" /> Pipeline aplicado ({creative.pipeline_applied_rules.length})
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr,1.2fr]">
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            {creative.signed_url ? (
              <img
                src={creative.signed_url}
                alt={creative.title ?? creative.concept}
                className="w-full h-auto object-contain"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center text-muted-foreground text-sm">
                URL expirado — recarregue a página
              </div>
            )}
          </div>

          <Tabs defaultValue="info">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="info">Detalhes</TabsTrigger>
              <TabsTrigger value="lineage">Linhagem</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Conceito</Label>
                <p className="text-sm">{creative.concept}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Dimensoes:</span> {creative.width}x{creative.height}</div>
                <div><span className="font-medium text-foreground">Custo:</span> US$ {creative.cost_usd.toFixed(4)}</div>
                <div><span className="font-medium text-foreground">Latencia:</span> {creative.latency_ms ?? '?'}ms</div>
                <div><span className="font-medium text-foreground">pHash:</span> <code className="text-[10px]">{creative.phash}</code></div>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor="title">Titulo</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                         disabled={isReadOnly} maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (virgula)</Label>
                  <Input id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                         disabled={isReadOnly} placeholder="ex: black-friday, oferta, hero" />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                            disabled={isReadOnly} rows={2} maxLength={1000} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={readyForPublish} onCheckedChange={setReadyForPublish} disabled={isReadOnly} />
                  <Label className="cursor-pointer" onClick={() => !isReadOnly && setReadyForPublish((v) => !v)}>
                    Marcar como pronto para publicar
                  </Label>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Prompt completo</Label>
                <pre className="text-xs whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 max-h-40 overflow-y-auto">
                  {creative.prompt}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="lineage" className="space-y-2">
              {!provenance && <p className="text-sm text-muted-foreground">Carregando linhagem...</p>}
              {provenance && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Profundidade: {provenance.depth} ({provenance.chain.length} no(s) na cadeia)
                  </p>
                  <ul className="space-y-1 text-sm">
                    {provenance.chain.map((node) => (
                      <li key={node.id} className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-2">
                        <Badge variant="outline" className="text-[10px]">d{node.depth}</Badge>
                        <span className="flex-1 truncate">{node.concept}</span>
                        <span className="text-xs text-muted-foreground">
                          {ASPECT_LABELS[node.format].label} · {STATUS_LABELS[node.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="compliance" className="space-y-2">
              {!compliance && <p className="text-sm text-muted-foreground">Sem registro de compliance.</p>}
              {compliance && (
                <>
                  <Badge variant={compliance.passed ? 'default' : 'destructive'} className="gap-1">
                    {compliance.passed ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {compliance.passed ? 'Aprovado no compliance' : 'Atenção no compliance'}
                  </Badge>
                  <ComplianceList title="Briefing (proibições do cliente)" hits={compliance.briefing_hits} />
                  <ComplianceList title="Baseline Meta" hits={compliance.baseline_hits} />
                  <ComplianceList title="OCR (texto na imagem)" hits={compliance.ocr_hits} />
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {!isReadOnly && (
          <>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
              <Button variant="default" size="sm" onClick={handleSave} disabled={busy !== null}>
                {busy === 'save' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Salvar metadata
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!creative.signed_url}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDiscard} disabled={busy !== null}>
                {busy === 'discard' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <Trash2 className="h-3 w-3 mr-1" /> Descartar
              </Button>
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <Label>Iterar com instrucao</Label>
              <Textarea
                value={iterateInstruction}
                onChange={(e) => setIterateInstruction(e.target.value)}
                placeholder="ex: troque o fundo por uma cena urbana ao por do sol"
                rows={2}
                maxLength={2000}
              />
              <Button size="sm" onClick={handleIterate} disabled={busy !== null || !iterateInstruction.trim()}>
                {busy === 'iterate' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Iterar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ComplianceList({ title, hits }: { title: string; hits: string[] }) {
  if (!hits || hits.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {hits.map((h) => <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>)}
      </div>
    </div>
  );
}

function errMsg(err: { kind: string; message?: string }): string {
  if ('message' in err && err.message) return err.message;
  return `erro: ${err.kind}`;
}
