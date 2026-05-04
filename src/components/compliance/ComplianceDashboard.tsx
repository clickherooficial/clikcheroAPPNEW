import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useComplianceStats } from '@/hooks/use-compliance';
import { ShieldCheck, AlertTriangle, XCircle, PauseCircle, BarChart3 } from 'lucide-react';

export function ComplianceDashboard() {
  const { data: stats, isLoading } = useComplianceStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum anúncio analisado</h3>
          <p className="text-sm text-muted-foreground">Clique em "Analisar Agora" para iniciar a primeira varredura de compliance.</p>
        </CardContent>
      </Card>
    );
  }

  const pctHealthy = stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 0;
  const pctWarning = stats.total > 0 ? Math.round((stats.warning / stats.total) * 100) : 0;
  const pctCritical = stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0;

  const cards = [
    { title: 'Total Analisados', value: stats.total, icon: BarChart3, color: 'text-blue-400' },
    { title: 'Conformes', value: `${pctHealthy}%`, icon: ShieldCheck, color: 'text-emerald-400' },
    { title: 'Alertas', value: `${pctWarning}%`, icon: AlertTriangle, color: 'text-amber-400' },
    { title: 'Críticos', value: `${pctCritical}%`, icon: XCircle, color: 'text-red-400' },
    { title: 'Pausados', value: stats.paused, icon: PauseCircle, color: 'text-orange-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
