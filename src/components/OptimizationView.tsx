// meta-edits-suite (Sprint 2/8) — View "Otimizacao".
// Lista campanhas via v_editable_campaigns, click expande CampaignEditPanel.
// Botao no topo abre BudgetShiftDialog pra mover budget entre 2 campanhas.
import { useMemo, useState } from 'react';
import { Sliders, ChevronRight, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEditableCampaigns } from '@/hooks/use-meta-edits';
import { CampaignEditPanel } from './optimization/CampaignEditPanel';
import { BudgetShiftDialog } from './optimization/BudgetShiftDialog';
import { cn } from '@/lib/utils';

interface RowCampaign {
  id: string;
  external_id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_strategy: string | null;
  start_time: string | null;
  stop_time: string | null;
  local_updated_at: string | null;
  updated_at: string | null;
  adset_count: number;
}

const OptimizationView = () => {
  const { data: rows = [], isLoading, error } = useEditableCampaigns();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);

  const candidates = useMemo(
    () => (rows as RowCampaign[]).map((r) => ({ id: r.id, name: r.name, daily_budget: r.daily_budget })),
    [rows],
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sliders className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Otimização</h1>
            <p className="text-xs text-muted-foreground">
              Edite campanhas e adsets ao vivo. Mudanças passam por safety rails (sandbox / rate limit / circuit breaker).
            </p>
          </div>
        </div>
        <Button onClick={() => setShiftOpen(true)} variant="outline" className="gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Realocar budget
        </Button>
      </div>

      {isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando campanhas…</Card>}
      {error && (
        <Card className="p-6 flex items-center gap-3 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm">Erro ao carregar campanhas: {(error as Error).message}</span>
        </Card>
      )}
      {!isLoading && !error && rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhuma campanha editável. Crie via Publicar Campanha primeiro.
        </Card>
      )}

      <div className="space-y-2">
        {(rows as RowCampaign[]).map((c) => {
          const expanded = expandedId === c.id;
          const drift = c.local_updated_at && c.updated_at && new Date(c.local_updated_at) < new Date(c.updated_at);
          return (
            <div key={c.id} className="space-y-2">
              <button
                onClick={() => setExpandedId(expanded ? null : c.id)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition',
                  expanded && 'border-primary/40 bg-accent/20',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition', expanded && 'rotate-90')} />
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{c.objective ?? '—'}</span>
                      <span>·</span>
                      <span>{c.adset_count} adsets</span>
                      {drift && <Badge variant="outline" className="text-orange-400 border-orange-500/40">drift</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                    {c.status}
                  </Badge>
                  <span className="font-mono text-xs">R${c.daily_budget ?? 0}/dia</span>
                </div>
              </button>
              {expanded && (
                <CampaignEditPanel campaign={c} onClose={() => setExpandedId(null)} />
              )}
            </div>
          );
        })}
      </div>

      <BudgetShiftDialog
        open={shiftOpen}
        onOpenChange={setShiftOpen}
        candidates={candidates}
      />
    </div>
  );
};

export default OptimizationView;
