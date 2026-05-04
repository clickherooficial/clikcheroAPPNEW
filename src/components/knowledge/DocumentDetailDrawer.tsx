// Drawer de detalhe + edit metadata + preview do extracted_text.
// Spec: knowledge-base-rag (task 6.3 — R7.3, R7.4, R7.7, R10.5)

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, RefreshCw, Trash2, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useKnowledge } from '@/hooks/use-knowledge';
import { TagInput } from '@/components/briefing/TagInput';
import type { KnowledgeDocument } from '@/types/knowledge';

interface Props {
  document: KnowledgeDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional chunk_index para destacar (quando aberto via citacao)
  highlightChunkIndex?: number;
}

const STATUS_LABELS: Record<KnowledgeDocument['status'], string> = {
  pending: 'Aguardando',
  extracting: 'Extraindo texto',
  embedding: 'Gerando embeddings',
  indexed: 'Indexado',
  failed: 'Falhou',
};

const STATUS_VARIANTS: Record<KnowledgeDocument['status'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  extracting: 'secondary',
  embedding: 'secondary',
  indexed: 'default',
  failed: 'destructive',
};

export function DocumentDetailDrawer({ document, open, onOpenChange, highlightChunkIndex }: Props) {
  const { updateMetadata, remove, retryFailed, isReadOnly, enrichWithSignedUrl } = useKnowledge();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSourceOfTruth, setIsSourceOfTruth] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!document) return;
    setTitle(document.title);
    setDescription(document.description ?? '');
    setTags(document.tags ?? []);
    setIsSourceOfTruth(document.is_source_of_truth);
    setSignedUrl(null);
    setConfirmDelete(false);
  }, [document]);

  useEffect(() => {
    if (!document || !open) return;
    enrichWithSignedUrl(document).then((d) => setSignedUrl(d.signed_url ?? null));
  }, [document, open, enrichWithSignedUrl]);

  if (!document) return null;

  const handleSave = async () => {
    setBusy(true);
    const result = await updateMetadata({
      id: document.id,
      patch: {
        title: title.trim(),
        description: description.trim() || null,
        tags,
        is_source_of_truth: isSourceOfTruth,
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Atualizado' });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    const result = await remove(document.id);
    setBusy(false);
    if (!result.ok) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
      return;
    }
    toast({ title: 'Documento removido' });
    onOpenChange(false);
  };

  const handleRetry = async () => {
    setBusy(true);
    const result = await retryFailed(document.id);
    setBusy(false);
    if (!result.ok) {
      toast({ title: 'Erro ao reprocessar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Reprocessamento agendado' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[document.status]}>
              {STATUS_LABELS[document.status]}
            </Badge>
            <Badge variant="outline">{document.type.toUpperCase()}</Badge>
            {document.source === 'chat_attachment' && (
              <Badge variant="outline">do chat</Badge>
            )}
          </div>
          <SheetTitle className="mt-2">{document.title}</SheetTitle>
          <SheetDescription>
            {(document.size_bytes / 1024).toFixed(0)} KB · adicionado{' '}
            {new Date(document.created_at).toLocaleDateString('pt-BR')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {document.status === 'failed' && document.status_error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="h-4 w-4" /> Falha no processamento
              </div>
              <p className="text-xs mt-1 text-destructive/80">{document.status_error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleRetry} disabled={busy}>
                <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
              </Button>
            </div>
          )}

          {/* Edit metadata */}
          <div className="space-y-3">
            <div>
              <Label>Titulo</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={busy || isReadOnly} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} disabled={busy || isReadOnly} />
            </div>
            <div>
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} disabled={busy || isReadOnly} max={20} />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label className="cursor-pointer">Fonte de verdade</Label>
                <p className="text-xs text-muted-foreground">A IA prioriza chunks deste documento na busca.</p>
              </div>
              <Switch checked={isSourceOfTruth} onCheckedChange={setIsSourceOfTruth} disabled={busy || isReadOnly} />
            </div>
          </div>

          {/* Acoes */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSave} disabled={busy || isReadOnly}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
            {signedUrl && (
              <Button variant="outline" asChild>
                <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir arquivo
                </a>
              </Button>
            )}
            <Button
              variant={confirmDelete ? 'destructive' : 'ghost'}
              onClick={handleDelete}
              disabled={busy || isReadOnly}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {confirmDelete ? 'Confirmar' : 'Remover'}
            </Button>
          </div>

          {/* Preview do texto extraido */}
          {document.extracted_text && (
            <div className="border-t pt-4">
              <Label>Conteudo extraido</Label>
              {highlightChunkIndex !== undefined && (
                <p className="text-xs text-muted-foreground mb-2">
                  Citacao destacada: chunk #{highlightChunkIndex}
                </p>
              )}
              <pre className="text-xs bg-muted rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap break-words">
                {document.extracted_text.slice(0, 10000)}
                {document.extracted_text.length > 10000 && '\n... (truncado para preview)'}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
