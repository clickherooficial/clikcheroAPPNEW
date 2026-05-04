// Visualizacao de historico de alteracoes do briefing.
// Spec: briefing-onboarding (task 7.3)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryRow {
  id: string;
  changed_at: string;
  changed_by: string | null;
  snapshot: Record<string, unknown>;
}

export function BriefingHistory() {
  const { company } = useAuth();
  const companyId = company?.id ?? null;
  const [openSnapshot, setOpenSnapshot] = useState<HistoryRow | null>(null);

  const query = useQuery({
    queryKey: ['briefing-history', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<HistoryRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('briefing_history' as never)
        .select('id, changed_at, changed_by, snapshot')
        .eq('company_id', companyId)
        .order('changed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown as HistoryRow[]) ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de alteracoes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteracao registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {(query.data ?? []).map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(h.changed_at), { addSuffix: true, locale: ptBR })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setOpenSnapshot(h)}>
                  Ver versão
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!openSnapshot} onOpenChange={(o) => !o && setOpenSnapshot(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Versão de{' '}
              {openSnapshot &&
                formatDistanceToNow(new Date(openSnapshot.changed_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
            </DialogTitle>
          </DialogHeader>
          {openSnapshot && (
            <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words">
              {JSON.stringify(openSnapshot.snapshot, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
