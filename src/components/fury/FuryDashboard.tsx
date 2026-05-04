import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFuryStats } from '@/hooks/use-fury';
import { Zap, AlertTriangle, BarChart3, Play } from 'lucide-react';

export function FuryDashboard() {
  const { data: stats, isLoading } = useFuryStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>
        ))}
      </div>
    );
  }

  const cards = [
    { title: 'Ações Hoje', value: stats?.actionsToday ?? 0, icon: Zap, color: 'text-amber-400' },
    { title: 'Alertas Pendentes', value: stats?.pendingAlerts ?? 0, icon: AlertTriangle, color: 'text-orange-400' },
    { title: 'Campanhas Avaliadas', value: stats?.campaignsEvaluated ?? 0, icon: BarChart3, color: 'text-blue-400' },
    { title: 'Ações Executadas', value: stats?.actionsExecuted ?? 0, icon: Play, color: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
