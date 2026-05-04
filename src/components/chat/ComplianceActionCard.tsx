// Card violeta inline mostrando resultado de add_prohibition + rescan_compliance.
// Renderizado abaixo da mensagem assistant quando metadata.compliance_action existe.

import { ShieldCheck, ShieldAlert, Search, AlertOctagon, PauseCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ComplianceAction } from '@/hooks/use-chat';

const CATEGORY_LABEL: Record<'word' | 'topic' | 'visual', string> = {
  word: 'Palavra',
  topic: 'Assunto',
  visual: 'Visual',
};

interface Props {
  action: ComplianceAction;
}

export function ComplianceActionCard({ action }: Props) {
  const { prohibition, rescan } = action;
  const hasViolations = (rescan?.violations ?? 0) > 0;

  return (
    <div className="max-w-3xl mx-auto w-full my-2 p-4 rounded-xl border border-violet-500/30 bg-violet-500/5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center text-violet-400 shrink-0">
          {hasViolations ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Compliance
            </span>
            {prohibition && <Badge variant="secondary">{CATEGORY_LABEL[prohibition.category]}</Badge>}
          </div>

          {prohibition && (
            <div>
              <div className="text-sm font-medium text-foreground">
                Proibição adicionada: <span className="text-violet-300">"{prohibition.value}"</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Aparece em <strong>Compliance</strong> e <strong>Configurações → Identidade</strong>.
                Novos criativos com isso sao bloqueados automaticamente.
              </div>
            </div>
          )}

          {rescan && (
            <div className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Search className="h-3.5 w-3.5 text-violet-400" />
                Rescan retroativo
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Analisados" value={rescan.scanned} />
                <Stat
                  label="Violacoes"
                  value={rescan.violations}
                  icon={<AlertOctagon className="h-3 w-3" />}
                  tone={hasViolations ? 'danger' : 'muted'}
                />
                <Stat
                  label="Pausados"
                  value={rescan.taken_down}
                  icon={<PauseCircle className="h-3 w-3" />}
                  tone={rescan.taken_down > 0 ? 'warning' : 'muted'}
                />
              </div>
              {!hasViolations && (
                <div className="text-[11px] text-muted-foreground pt-1">
                  Nenhum criativo ativo viola a nova regra. Tudo limpo.
                </div>
              )}
              {hasViolations && (
                <div className="text-[11px] text-amber-300 pt-1">
                  Veja detalhes em Compliance ou peca uma análise dos afetados.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'muted',
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: 'muted' | 'danger' | 'warning';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-400'
      : tone === 'warning'
        ? 'text-amber-400'
        : 'text-foreground';
  return (
    <div className="flex flex-col items-start">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`flex items-center gap-1 text-base font-semibold ${toneClass}`}>
        {icon}
        {value}
      </div>
    </div>
  );
}
