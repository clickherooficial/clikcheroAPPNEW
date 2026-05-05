// Wrapper de CreativeGalleryInline que aceita ids (vindos da tag <creative-gallery>)
// e busca os rows + signed URLs antes de renderizar.
// Spec: ai-creative-generation (task 10.4)

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { CreativeGalleryInline } from './CreativeGalleryInline';

interface InlineCreative {
  id: string;
  signed_url: string;
  format: 'feed_1x1' | 'story_9x16' | 'reels_4x5';
  model_used: 'gemini-2.5-flash-image' | 'gpt-image-1';
  cost_usd?: number;
  is_near_duplicate?: boolean;
  compliance_warning?: boolean;
  status: 'generated' | 'approved' | 'discarded' | 'published';
}

interface ChatCreativeGalleryProps {
  ids: string[];
  onSendSystemMessage?: (text: string) => void;
  /** Persiste novo bubble assistant com tag de galeria (Vari/Iter pela UI — item 9). */
  appendAssistantMarkdown?: (markdown: string) => Promise<boolean>;
}

export function ChatCreativeGallery({
  ids,
  onSendSystemMessage,
  appendAssistantMarkdown,
}: ChatCreativeGalleryProps) {
  const [items, setItems] = useState<InlineCreative[] | null>(null);
  const [missingIds, setMissingIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setItems([]);
      return;
    }

    (async () => {
      const { data: rows } = await supabase
        .from('creatives_generated' as never)
        .select('id, format, model_used, cost_usd, is_near_duplicate, compliance_warning, storage_path, status')
        .in('id', ids);

      const found = ((rows ?? []) as Array<{
        id: string;
        format: InlineCreative['format'];
        model_used: InlineCreative['model_used'];
        cost_usd: number;
        is_near_duplicate: boolean;
        compliance_warning: boolean;
        storage_path: string;
        status: InlineCreative['status'];
      }>);

      const enriched = await Promise.all(
        found.map(async (r) => {
          const { data: signed } = await supabase.storage
            .from('generated-creatives')
            .createSignedUrl(r.storage_path, 3600);
          return {
            id: r.id,
            signed_url: signed?.signedUrl ?? '',
            format: r.format,
            model_used: r.model_used,
            cost_usd: r.cost_usd,
            is_near_duplicate: r.is_near_duplicate,
            compliance_warning: r.compliance_warning,
            status: r.status,
          };
        }),
      );

      if (cancelled) return;
      setItems(enriched);
      const foundIds = new Set(enriched.map((c) => c.id));
      setMissingIds(ids.filter((id) => !foundIds.has(id)));
    })();

    return () => { cancelled = true; };
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando criativos...
      </div>
    );
  }

  return (
    <>
      {items.length > 0 && (
        <CreativeGalleryInline
          creatives={items}
          onSendSystemMessage={onSendSystemMessage}
          appendAssistantMarkdown={appendAssistantMarkdown}
        />
      )}
      {missingIds.length > 0 && (
        <div className="flex flex-wrap gap-1 my-2">
          {missingIds.map((id) => (
            <Badge key={id} variant="outline" className="text-[10px] gap-1">
              <AlertCircle className="h-3 w-3" />
              criativo não encontrado: {id.slice(0, 8)}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}
