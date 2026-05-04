import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useActionLedger } from '@/hooks/use-safety';
import {
  BLOCK_REASON_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TRIGGERED_BY_LABELS,
  type LedgerStatus,
  type TriggeredBy,
} from '@/types/safety';
import { cn } from '@/lib/utils';

export function ActionLedgerTable() {
  const [statusFilter, setStatusFilter] = useState<LedgerStatus | 'all'>('all');
  const [triggeredByFilter, setTriggeredByFilter] = useState<TriggeredBy | 'all'>('all');

  const { data: rows, isLoading } = useActionLedger({
    status: statusFilter,
    triggeredBy: triggeredByFilter,
    limit: 50,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Historico de acoes (50 ultimas)</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as LedgerStatus | 'all')}
            >
              <SelectTrigger className="w-40 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {(['succeeded', 'simulated', 'failed', 'blocked', 'rolled_back'] as LedgerStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select
              value={triggeredByFilter}
              onValueChange={(v) => setTriggeredByFilter(v as TriggeredBy | 'all')}
            >
              <SelectTrigger className="w-40 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {(['user', 'agent', 'cron', 'rule', 'plan'] as TriggeredBy[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGERED_BY_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Quando</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead className="w-28">Origem</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="text-right">Custo (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (!rows || rows.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma acao registrada com esses filtros.
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.executed_at), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.agent_name}</TableCell>
                  <TableCell className="text-xs">{row.action_kind}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.target_kind && row.target_external_id
                      ? `${row.target_kind}:${row.target_external_id.slice(0, 12)}...`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {TRIGGERED_BY_LABELS[row.triggered_by]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[row.status])}>
                      {STATUS_LABELS[row.status]}
                    </Badge>
                    {row.block_reason && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {BLOCK_REASON_LABELS[row.block_reason]}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {row.cost_brl_estimate != null
                      ? `R$ ${row.cost_brl_estimate.toFixed(2)}`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
