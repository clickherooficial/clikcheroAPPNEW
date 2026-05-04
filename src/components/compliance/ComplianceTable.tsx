import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useComplianceScores, type ComplianceScore } from '@/hooks/use-compliance';
import { ShieldCheck, AlertTriangle, XCircle, Eye, Loader2 } from 'lucide-react';
import { ComplianceDetail } from './ComplianceDetail';

const HEALTH_BADGE: Record<string, { label: string; className: string; Icon: typeof ShieldCheck }> = {
  healthy: { label: 'Conforme', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: ShieldCheck },
  warning: { label: 'Alerta', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: AlertTriangle },
  critical: { label: 'Crítico', className: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: XCircle },
};

export function ComplianceTable() {
  const { data: scores, isLoading, error } = useComplianceScores();
  const [selectedScore, setSelectedScore] = useState<ComplianceScore | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-red-400 text-sm">
          Erro: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Nenhum anúncio analisado ainda. Clique em "Analisar Agora".
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anúncio</TableHead>
              <TableHead className="w-[100px]">Score</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[100px]">Copy</TableHead>
              <TableHead className="w-[100px]">Visual</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((score) => {
              const badge = HEALTH_BADGE[score.health_status] ?? HEALTH_BADGE.healthy;
              return (
                <TableRow key={score.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {score.creative_image_url ? (
                        <img src={score.creative_image_url} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          {score.creative_type?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm truncate max-w-[200px]">
                          {score.creative_name ?? score.creative_headline ?? 'Sem nome'}
                        </div>
                        <div className="text-xs text-muted-foreground">{score.external_ad_id ?? ''}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-lg font-bold ${
                      score.final_score >= 80 ? 'text-emerald-400' :
                      score.final_score >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {score.final_score}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${badge.className} border`}>
                      <badge.Icon className="w-3 h-3 mr-1" />
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{score.copy_score ?? '—'}</TableCell>
                  <TableCell className="text-sm">{score.image_score ?? '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedScore(score)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {selectedScore && (
        <ComplianceDetail score={selectedScore} onClose={() => setSelectedScore(null)} />
      )}
    </>
  );
}
