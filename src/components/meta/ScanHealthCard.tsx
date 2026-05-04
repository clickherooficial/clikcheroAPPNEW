import { useMetaScanHealth, type HealthStatus } from '@/hooks/use-meta-scan-health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const HEALTH_STYLES: Record<HealthStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  healthy: { label: 'Saudavel', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 },
  degraded: { label: 'Degradado', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: AlertTriangle },
  stale: { label: 'Travada', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30', Icon: Clock },
  expired: { label: 'Token expirado', className: 'bg-red-500/15 text-red-300 border-red-500/30', Icon: XCircle },
};

const ERROR_LABELS: Record<string, string> = {
  token_expired: 'Token expirado',
  permission_denied: 'Permissão negada',
  rate_limit: 'Limite de taxa',
  not_found: 'Não encontrado',
  network: 'Rede',
  server_error: 'Erro do servidor Meta',
  unknown: 'Desconhecido',
};

function relativeTime(iso: string | null): string {
  if (!iso) return 'nunca';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return 'desconhecido';
  }
}

// Para next_scan_at: se ja passou da hora, mostra "em breve" (cron tem janela de 15min)
function relativeFutureTime(iso: string | null): string {
  if (!iso) return 'não agendada';
  try {
    const target = new Date(iso).getTime();
    if (target <= Date.now()) return 'em breve';
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return 'desconhecido';
  }
}

export function ScanHealthCard() {
  const { data, isLoading, error } = useMetaScanHealth();

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-white/60">
            <Activity className="w-5 h-5 animate-pulse" />
            <span>Carregando status da varredura...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/5 border-red-500/20">
        <CardContent className="p-6 text-red-300 text-sm">
          Falha ao carregar status: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const style = HEALTH_STYLES[data.health_status] ?? HEALTH_STYLES.healthy;
  const Icon = style.Icon;
  const summary = data.last_error_summary ?? {};
  const summaryEntries = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Status da Varredura
          </CardTitle>
          <Badge className={`${style.className} border`}>
            <Icon className="w-3 h-3 mr-1" />
            {style.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-white/50 text-xs">Última execução</div>
            <div className="text-white/90">{relativeTime(data.last_success_at)}</div>
          </div>
          <div>
            <div className="text-white/50 text-xs">Próxima execução</div>
            <div className="text-white/90">{relativeFutureTime(data.next_scan_at)}</div>
          </div>
          <div>
            <div className="text-white/50 text-xs">Falhas consecutivas</div>
            <div className={data.consecutive_failures > 0 ? 'text-amber-300' : 'text-white/90'}>
              {data.consecutive_failures}
            </div>
          </div>
          <div>
            <div className="text-white/50 text-xs">Intervalo</div>
            <div className="text-white/90">{data.scan_interval_hours ?? 24}h</div>
          </div>
        </div>

        {summaryEntries.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-white/50 text-xs mb-2">Erros recentes</div>
            <div className="flex flex-wrap gap-2">
              {summaryEntries.map(([code, count]) => (
                <Badge
                  key={code}
                  variant="outline"
                  className="bg-white/5 border-white/10 text-white/70 text-xs"
                >
                  {ERROR_LABELS[code] ?? code}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
