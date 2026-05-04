// Estudio — biblioteca permanente de criativos gerados.
// Spec: ai-creative-generation (task 9.2 — R7.1, R7.6)

import { useMemo, useState } from 'react';
import { navigateToView } from '@/lib/view-navigation';
import {
  Sparkles, Search, Download, Check, Trash2, Loader2, MessageSquare, AlertTriangle, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreatives } from '@/hooks/use-creatives';
import { useApplyCreativePipeline } from '@/hooks/useApplyCreativePipeline';
import { useToast } from '@/hooks/use-toast';
import {
  ASPECT_LABELS,
  STATUS_LABELS,
  type AspectFormat,
  type Creative,
  type CreativeStatus,
} from '@/types/creative';
import { CreativeUsageBanner } from './CreativeUsageBanner';
import { CreativeUsageStrip } from './CreativeUsageStrip';
import { CreativeDetailDialog } from './CreativeDetailDialog';

const STATUS_FILTERS: Array<CreativeStatus | 'all'> = ['all', 'generated', 'approved', 'discarded', 'published'];
const FORMAT_FILTERS: Array<AspectFormat | 'all'> = ['all', 'feed_1x1', 'story_9x16', 'reels_4x5'];

export function StudioView() {
  const { creatives, isLoading, isReadOnly, filters, setFilters, approve, exportZip } = useCreatives();
  const applyPipeline = useApplyCreativePipeline();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CreativeStatus | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<AspectFormat | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Creative | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const visible = useMemo(() => creatives.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (formatFilter !== 'all' && c.format !== formatFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [c.title, c.concept, c.description, ...(c.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [creatives, statusFilter, formatFilter, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    const approvedIds: string[] = [];
    for (const id of selected) {
      const r = await approve(id);
      if (r.ok) {
        ok++;
        approvedIds.push(id);
      } else {
        fail++;
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    toast({ title: 'Aprovação em lote', description: `${ok} aprovado(s), ${fail} falha(s).` });

    // Fase 6 (T6.2): fire-and-forget apply-creative-pipeline para cada aprovado
    for (const id of approvedIds) {
      applyPipeline
        .mutateAsync({ creative_id: id, target_table: 'creatives_generated' })
        .catch((err) => console.warn('[apply-pipeline] failed (non-blocking):', err));
    }
  };

  const handleBulkExport = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const r = await exportZip(Array.from(selected));
    setBulkBusy(false);
    if (r.ok) {
      window.open(r.value.download_url, '_blank');
      toast({ title: 'ZIP gerado', description: `${r.value.file_count} arquivo(s).` });
    } else {
      toast({ title: 'Erro', description: r.error.kind, variant: 'destructive' });
    }
  };

  const empty = !isLoading && visible.length === 0;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <CreativeUsageStrip />
      <CreativeUsageBanner />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Estudio
          </h2>
          <p className="text-sm text-muted-foreground">Biblioteca permanente dos seus criativos gerados pela IA.</p>
        </div>
        {selected.size > 0 && !isReadOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={handleBulkApprove} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Aprovar ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkExport} disabled={bulkBusy}>
              <Download className="h-3 w-3 mr-1" />
              ZIP ({selected.size})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por titulo, conceito, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CreativeStatus | 'all')}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'Todos status' : STATUS_LABELS[s as CreativeStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={formatFilter} onValueChange={(v) => setFormatFilter(v as AspectFormat | 'all')}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMAT_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {f === 'all' ? 'Todos formatos' : ASPECT_LABELS[f as AspectFormat].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Carregando criativos...
        </div>
      )}

      {empty && (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Nenhum criativo aqui ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Peca pra IA gerar criativos diretamente no chat.
          </p>
          <Button variant="default" onClick={() => window.location.assign('/?view=chat')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Abrir chat
          </Button>
        </div>
      )}

      {!isLoading && !empty && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((c) => {
            const aspect = ASPECT_LABELS[c.format];
            const aspectClass = c.format === 'feed_1x1' ? 'aspect-square'
              : c.format === 'story_9x16' ? 'aspect-[9/16]'
              : 'aspect-[4/5]';
            const isSel = selected.has(c.id);

            return (
              <div
                key={c.id}
                className={`relative rounded-xl border bg-card/50 overflow-hidden transition-all ${
                  isSel ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggleSelect(c.id)}
                    disabled={isReadOnly}
                    className="bg-background/80"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(c)}
                  className={`${aspectClass} w-full bg-muted/40 overflow-hidden relative group`}
                >
                  {c.signed_url ? (
                    <img
                      src={c.signed_url}
                      alt={c.title ?? c.concept}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      sem preview
                    </div>
                  )}
                  {c.compliance_warning && (
                    <Badge
                      variant="destructive"
                      className="absolute top-2 right-2 gap-1 cursor-pointer hover:opacity-80"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToView('compliance');
                      }}
                      title="Atenção: aviso de compliance. Click para detalhes."
                    >
                      <AlertTriangle className="h-3 w-3" /> Compliance
                    </Badge>
                  )}
                </button>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate">{c.title ?? c.concept}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">{aspect.ratio}</Badge>
                    <Badge
                      variant={c.status === 'approved' || c.status === 'published' ? 'default'
                        : c.status === 'discarded' ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {STATUS_LABELS[c.status]}
                    </Badge>
                    {c.ready_for_publish && <Badge variant="default" className="text-[10px]">Pronto</Badge>}
                    {Array.isArray(c.pipeline_applied_rules) && c.pipeline_applied_rules.length > 0 && (
                      <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300">
                        Pipeline ({c.pipeline_applied_rules.length})
                      </Badge>
                    )}
                  </div>
                  {(c.status === 'approved' || c.status === 'published') && (
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full h-7 text-[11px] mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToView('publisher');
                      }}
                    >
                      <Rocket className="h-3 w-3 mr-1" /> Publicar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreativeDetailDialog
        creative={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </div>
  );
}
