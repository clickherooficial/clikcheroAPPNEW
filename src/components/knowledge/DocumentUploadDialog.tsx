// Dialog de upload de documento na KB.
// Spec: knowledge-base-rag (task 6.2 — R1.1, R1.2, R1.6, R1.7, R8.3)

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useKnowledge } from '@/hooks/use-knowledge';
import { useKnowledgeUsage } from '@/hooks/use-knowledge-usage';
import { TagInput } from '@/components/briefing/TagInput';
import { KB_ALL_ALLOWED_MIMES, KB_MAX_FILE_BYTES } from '@/types/knowledge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentUploadDialog({ open, onOpenChange }: Props) {
  const { upload, isReadOnly } = useKnowledge();
  const usage = useKnowledgeUsage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const blocked = usage.status === 'blocked';

  const handleSubmit = async () => {
    if (!file) return;
    setBusy(true);
    const result = await upload({
      file,
      meta: {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        tags,
      },
    });
    setBusy(false);
    if (!result.ok) {
      const msg =
        result.error.kind === 'too_large'
          ? `Arquivo maior que ${(KB_MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB`
          : result.error.kind === 'unsupported_mime'
          ? 'Formato não suportado (PDF, DOCX, XLSX, CSV, JSON, TXT, MD ou imagem)'
          : result.error.kind === 'quota_exceeded'
          ? `Quota de ${result.error.dimension} atingida`
          : 'Erro ao enviar arquivo';
      toast({ title: 'Upload falhou', description: msg, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Documento enviado',
      description: 'Processamento em andamento — você vera o status na lista.',
    });
    setFile(null);
    setTitle('');
    setDescription('');
    setTags([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar a memória</DialogTitle>
          <DialogDescription>
            A IA do Fury vai indexar o conteudo e poder consulta-lo em conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {blocked && (
            <div className="text-sm text-destructive">
              Quota atingida em {usage.blockedDimensions.join(', ')}. Upgrade necessario.
            </div>
          )}

          <div>
            <Label>Arquivo</Label>
            <div className="flex items-center gap-2">
              <Input
                value={file?.name ?? ''}
                placeholder="Nenhum arquivo selecionado"
                readOnly
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || isReadOnly || blocked}>
                <Upload className="h-4 w-4 mr-1" /> Escolher
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={KB_ALL_ALLOWED_MIMES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!title) setTitle(f.name);
                  }
                  e.target.value = '';
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Max 25MB. PDF/DOCX/XLSX/CSV/JSON/TXT/MD/PNG/JPG/WEBP.</p>
          </div>

          <div>
            <Label>Titulo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={busy} />
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} disabled={busy} />
          </div>

          <div>
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} placeholder="Pressione enter para adicionar" disabled={busy} max={20} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!file || busy || isReadOnly || blocked}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
