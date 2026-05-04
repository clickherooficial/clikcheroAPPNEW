import { X, FileText, FileImage, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/chat-constants';
import type { PendingAttachment } from '@/hooks/use-attachments';

interface AttachmentPreviewListProps {
  pending: PendingAttachment[];
  onRemove: (localId: string) => void;
}

export function AttachmentPreviewList({ pending, onRemove }: AttachmentPreviewListProps) {
  if (!pending.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1">
      {pending.map((item) => (
        <AttachmentPreview key={item.localId} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface AttachmentPreviewProps {
  item: PendingAttachment;
  onRemove: (localId: string) => void;
}

function AttachmentPreview({ item, onRemove }: AttachmentPreviewProps) {
  const isUploading = item.uploadStatus === 'uploading' || item.uploadStatus === 'idle';
  const isFailed = item.uploadStatus === 'failed';
  const isExtractionPending = item.kind === 'document' && item.extractionStatus === 'pending';
  const isExtractionFailed = item.kind === 'document' && item.extractionStatus === 'failed';
  const isReady =
    item.uploadStatus === 'uploaded' &&
    (item.kind === 'image' ||
      item.extractionStatus === 'done' ||
      item.extractionStatus === 'skipped');

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5 pr-7 max-w-[260px]',
        isFailed && 'border-red-300 bg-red-50',
        isReady && 'border-emerald-200',
        !isFailed && !isReady && 'border-border/60'
      )}
    >
      {/* Thumb / icon */}
      {item.kind === 'image' && item.previewUrl ? (
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-9 w-9 rounded-md object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          {item.kind === 'image' ? (
            <FileImage className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-medium truncate text-foreground" title={item.file.name}>
          {item.file.name}
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {formatFileSize(item.file.size)}
          {isUploading && (
            <>
              <Loader2 className="h-2.5 w-2.5 animate-spin ml-0.5" />
              <span>enviando</span>
            </>
          )}
          {isExtractionPending && (
            <>
              <Loader2 className="h-2.5 w-2.5 animate-spin ml-0.5" />
              <span>processando</span>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="h-2.5 w-2.5 ml-0.5 text-red-500" />
              <span className="text-red-500">{item.uploadError ?? 'falhou'}</span>
            </>
          )}
          {isExtractionFailed && (
            <>
              <AlertCircle className="h-2.5 w-2.5 ml-0.5 text-amber-500" />
              <span className="text-amber-600">conteudo não lido</span>
            </>
          )}
          {isReady && !isExtractionFailed && (
            <>
              <CheckCircle2 className="h-2.5 w-2.5 ml-0.5 text-emerald-500" />
            </>
          )}
        </span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(item.localId)}
        aria-label="Remover anexo"
        className="absolute right-1 top-1 rounded-full p-0.5 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
