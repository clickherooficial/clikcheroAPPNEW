import { useMemo, useState } from "react";
import { ImagePlus, MoreHorizontal, Loader2, Video as VideoIcon, AlertCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreatives, type CreativeRow } from "@/hooks/use-campaigns";
import { humanizeStatus } from "@/lib/meta-labels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { CreativePreviewModal } from "@/components/CreativePreviewModal";

type StatusFilter = "all" | "active" | "paused";

function cleanName(raw: string | null): string {
  if (!raw) return "Sem nome";
  let cleaned = raw
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s+\d{4}-\d{2}-\d{2}-[a-f0-9]{8,}\b/gi, "")
    .replace(/\s+[a-f0-9]{16,}\b/gi, "")
    .trim();
  cleaned = cleaned.replace(/[\s-]+$/, "").trim();
  return cleaned.length > 0 ? cleaned : "Sem nome";
}

// Criativo so e considerado "ativo" quando o ad E a campanha pai estao ambos ativos.
// Sem isso, ads de campanhas pausadas aparecem como ativos (Meta nao desliga
// auto o status do ad quando a campanha pausa).
function isCreativeTrulyActive(c: CreativeRow): boolean {
  if (c.status !== "ACTIVE") return false;
  const camp = c.campaign;
  if (!camp) return false;  // sem campanha vinculada — não da pra confirmar
  // effective_status reflete o estado real considerando hierarquia (campaign/account/etc)
  // Se nao tiver effective_status, cai no status simples
  const effective = camp.effective_status ?? camp.status;
  return effective === "ACTIVE";
}

// Subcomponente com error state proprio — evita DOM manipulation imperativa
function CreativeImage({ src, alt, isVideo }: { src: string | null; alt: string; isVideo: boolean }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return isVideo ? (
      <VideoIcon className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
    ) : (
      <ImagePlus className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      {isVideo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <Play className="h-5 w-5 text-black fill-black translate-x-0.5" />
          </div>
        </div>
      )}
    </>
  );
}

function statusBadgeClass(raw: string | null): string {
  if (raw === "ACTIVE") return "border-emerald-600/10 bg-emerald-50 text-emerald-700";
  if (raw === "PAUSED" || raw === "DELETED" || raw === "ARCHIVED") return "border-border bg-secondary text-muted-foreground";
  if (raw === "DISAPPROVED" || raw === "WITH_ISSUES") return "border-red-600/10 bg-red-50 text-red-700";
  return "border-amber-600/10 bg-amber-50 text-amber-700";
}

function CreativeCard({ c, onClick }: { c: CreativeRow; onClick: () => void }) {
  const isVideo = c.detected_media_type === "video" || c.type === "video";
  const mediaTypeLabel = isVideo ? "video" : c.detected_media_type === "image" ? "imagem" : null;
  const campaignName = c.campaign?.name ?? null;
  const subtitle = campaignName || (c.headline && c.headline.trim()) || mediaTypeLabel || "—";
  const displayName = cleanName(c.name);
  // Usa thumbnail_url (preview de video) com fallback para image_url
  const previewSrc = c.thumbnail_url || c.image_url || null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left overflow-hidden rounded-xl border border-border/60 bg-card shadow-e1 transition-all duration-base ease-smooth hover:-translate-y-0.5 hover:shadow-e3 hover:border-primary/30 animate-slide-up"
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        <CreativeImage src={previewSrc} alt={displayName} isVideo={isVideo} />
        <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusBadgeClass(c.status))}>
            {humanizeStatus(c.status)}
          </span>
        </div>
        {c.text && c.text.trim() && (
          <p className="line-clamp-2 text-[12px] text-muted-foreground">{c.text}</p>
        )}
        {c.call_to_action && (
          <div className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{c.call_to_action}</div>
        )}
      </div>
    </button>
  );
}

const CreativesView = () => {
  const { data: creatives = [], isLoading, isError, error, refetch } = useCreatives();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [selected, setSelected] = useState<CreativeRow | null>(null);

  const counts = useMemo(() => {
    let active = 0;
    let paused = 0;
    for (const c of creatives) {
      if (isCreativeTrulyActive(c)) active++;
      else paused++;
    }
    return { all: creatives.length, active, paused };
  }, [creatives]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return creatives;
    if (statusFilter === "active") return creatives.filter(isCreativeTrulyActive);
    return creatives.filter((c) => !isCreativeTrulyActive(c));
  }, [creatives, statusFilter]);

  return (
    <div className="mx-auto h-full max-w-[1600px] animate-fade-in space-y-6 overflow-y-auto p-4 md:p-6 xl:p-8">
      <PageHeader
        title="Criativos"
        description="Criativos sincronizados das suas campanhas Meta"
        badge={
          !isLoading && !isError ? (
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-medium text-muted-foreground tabular-nums">
              {filtered.length}{statusFilter !== "all" ? ` / ${counts.all}` : ""}
            </span>
          ) : null
        }
      />

      {/* Status filter toggle */}
      {!isLoading && !isError && creatives.length > 0 && (
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {([
            { key: "active", label: `Ativos (${counts.active})` },
            { key: "paused", label: `Pausados (${counts.paused})` },
            { key: "all", label: `Todos (${counts.all})` },
          ] as Array<{ key: StatusFilter; label: string }>).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-12 text-center shadow-e1">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <p className="text-[13px] text-muted-foreground">
            Falha ao carregar criativos{error?.message ? `: ${error.message}` : ""}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : creatives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <ImagePlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-[13px] text-muted-foreground">
            Nenhum criativo sincronizado. Va em Integrações e clique em Sincronizar.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-[13px] text-muted-foreground">
            Nenhum criativo {statusFilter === "active" ? "ativo" : "pausado"} no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <CreativeCard key={c.id} c={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}

      <CreativePreviewModal creative={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CreativesView;
