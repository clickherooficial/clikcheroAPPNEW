import { useState } from 'react';
import { FileText, Download, FileImage, BookmarkPlus, Check } from 'lucide-react';
import { navigateToView } from '@/lib/view-navigation';
import { ToastAction } from '@/components/ui/toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMessageAttachments, useAttachmentsByIds } from '@/hooks/use-message-attachments';
import { useKnowledge } from '@/hooks/use-knowledge';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/chat-constants';

interface MessageAttachmentsProps {
  /** Use messageId para mensagens carregadas do DB (com message_id ja vinculado) */
  messageId?: string | null;
  /** OU use attachmentIds para mensagens da sessao atual (que tem so id local) */
  attachmentIds?: string[];
}

/**
 * Renderiza anexos de uma mensagem (historico ou sessao atual).
 * Imagens viram thumbs clicaveis (lightbox); documentos viram cards com download.
 * Spec: chat-multimodal REQ-5
 */
export function MessageAttachments({ messageId, attachmentIds }: MessageAttachmentsProps) {
  const byMessage = useMessageAttachments(messageId ?? null);
  const byIds = useAttachmentsByIds(attachmentIds);
  const attachments = attachmentIds?.length ? byIds.data : byMessage.data;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const { promoteFromChat, isReadOnly } = useKnowledge();
  const { toast } = useToast();

  const handleSaveToMemory = async (attachmentId: string, originalFilename: string | null) => {
    const result = await promoteFromChat({
      attachmentId,
      meta: { title: originalFilename ?? undefined },
    });
    if (!result.ok) {
      const msg =
        result.error.kind === 'duplicate'
          ? 'Este anexo ja esta na memória'
          : result.error.kind === 'unsupported_mime'
          ? 'Formato não suportado pela memória'
          : 'Não foi possivel salvar';
      toast({ title: msg, variant: result.error.kind === 'duplicate' ? 'default' : 'destructive' });
      if (result.error.kind === 'duplicate') {
        setSavedIds((prev) => new Set([...prev, attachmentId]));
      }
      return;
    }
    setSavedIds((prev) => new Set([...prev, attachmentId]));
    toast({
      title: 'Salvo na memória',
      description: 'A IA ja pode usar este conteudo nas respostas.',
      action: (
        <ToastAction altText="Ver na memória" onClick={() => navigateToView('cerebro', { cerebroTab: 'memória' })}>
          Ver
        </ToastAction>
      ),
    });
  };

  if (!attachments?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => {
        const isSaved = savedIds.has(att.id);
        const SaveButton = (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!isSaved) handleSaveToMemory(att.id, att.original_filename ?? null);
            }}
            disabled={isReadOnly || isSaved}
            title={isSaved ? 'Ja salvo na memória' : 'Salvar na memória'}
            className="rounded-md bg-background/80 backdrop-blur p-1.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Salvar na memória"
          >
            {isSaved ? <Check className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          </button>
        );

        if (att.kind === 'image' && att.signed_url) {
          return (
            <div
              key={att.id}
              className="relative group rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => setLightboxUrl(att.signed_url ?? null)}
                className="block"
              >
                <img
                  src={att.signed_url}
                  alt={att.original_filename ?? 'anexo'}
                  className="h-32 max-w-[260px] w-auto object-cover"
                  loading="lazy"
                />
              </button>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {SaveButton}
              </div>
            </div>
          );
        }

        // Documento
        return (
          <div key={att.id} className="relative group flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 hover:border-primary/40 transition-colors max-w-[260px]">
            <a
              href={att.signed_url}
              download={att.original_filename ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                {att.kind === 'image' ? (
                  <FileImage className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-foreground">
                  {att.original_filename ?? 'documento'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(att.size_bytes)}
                  {att.extraction_status === 'failed' && ' · não foi possivel ler'}
                  {att.extraction_status === 'skipped' && ' · conteudo não processado'}
                </p>
              </div>
              <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </a>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {SaveButton}
            </div>
          </div>
        );
      })}

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="anexo"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
