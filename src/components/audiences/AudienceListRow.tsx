// audience-management (Sprint 3/8) — row de tabela de audiencia.
import { Users, Sparkles, Globe, Smartphone, Activity, MoreVertical, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { MetaAudience } from '@/types/audiences';

const SUBTYPE_ICON: Record<MetaAudience['subtype'], React.ElementType> = {
  CUSTOM: Users,
  LOOKALIKE: Sparkles,
  WEBSITE: Globe,
  APP: Smartphone,
  ENGAGEMENT: Activity,
};

function formatCount(lower: number | null, upper: number | null): string {
  if (lower == null && upper == null) return '—';
  if (lower === 0 && upper === 0) return 'Vazia';
  const lo = Number(lower ?? 0);
  const up = Number(upper ?? lo);
  if (lo < 1000 && up < 1000) return 'Pequena (<1k)';
  if (lo < 10000) return `${(lo / 1000).toFixed(0)}k–${(up / 1000).toFixed(0)}k`;
  if (lo < 100000) return `${(lo / 1000).toFixed(0)}k+`;
  return `${(lo / 1000000).toFixed(1)}M+`;
}

function deliveryLabel(d: MetaAudience['delivery_status']): { label: string; tone: 'ok' | 'processing' | 'error' } {
  const code = d?.code;
  if (code === 200) return { label: 'Ready', tone: 'ok' };
  if (code === 300 || d?.description?.toLowerCase().includes('processing')) return { label: 'Processing', tone: 'processing' };
  if (code && code >= 400) return { label: d?.description ?? 'Error', tone: 'error' };
  return { label: d?.description ?? '—', tone: 'processing' };
}

interface Props {
  audience: MetaAudience;
  onCreateLookalike: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AudienceListRow({ audience, onCreateLookalike, onEdit, onDelete }: Props) {
  const Icon = SUBTYPE_ICON[audience.subtype] ?? Users;
  const delivery = deliveryLabel(audience.delivery_status);

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{audience.name}</span>
          <Badge variant="outline" className="text-[10px] uppercase">{audience.subtype}</Badge>
          {audience.parent_audience_id && (
            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
              <Layers className="h-3 w-3" />
              LAL
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
          <span>{formatCount(audience.approximate_count_lower_bound, audience.approximate_count_upper_bound)}</span>
          <span>·</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              delivery.tone === 'ok' && 'border-emerald-500/40 text-emerald-400',
              delivery.tone === 'processing' && 'border-amber-500/40 text-amber-400',
              delivery.tone === 'error' && 'border-destructive/40 text-destructive',
            )}
          >
            {delivery.label}
          </Badge>
          {audience.retention_days != null && (
            <>
              <span>·</span>
              <span>{audience.retention_days}d retencao</span>
            </>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {audience.subtype === 'CUSTOM' && (
            <DropdownMenuItem onClick={onCreateLookalike}>
              <Sparkles className="h-4 w-4 mr-2" />
              Criar Lookalike
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onEdit}>Editar nome / retention</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">Deletar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
