// Banner de quota da Knowledge Base.
// Spec: knowledge-base-rag (task 6.4 — R8.2, R8.3)

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useKnowledgeUsage } from '@/hooks/use-knowledge-usage';
import type { UsageDimension } from '@/types/knowledge';

const DIM_LABELS: Record<UsageDimension, string> = {
  storage: 'armazenamento',
  documents: 'documentos',
  embeddings: 'embeddings deste mes',
};

function formatBytes(b: number): string {
  if (b > 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b > 1_048_576) return `${(b / 1_048_576).toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

export function KnowledgeUsageBanner() {
  const usage = useKnowledgeUsage();

  if (usage.isLoading || usage.status === 'ok') return null;

  const isBlocked = usage.status === 'blocked';
  const dims = isBlocked ? usage.blockedDimensions : usage.warningDimensions;
  const labels = dims.map((d) => DIM_LABELS[d] ?? d).join(', ');

  return (
    <Alert variant={isBlocked ? 'destructive' : 'default'} className="mb-4">
      {isBlocked ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>
        {isBlocked
          ? 'Quota da memória atingida'
          : 'Quota da memória perto do limite'}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          {isBlocked
            ? `Você atingiu 100% de ${labels}. Novos uploads/processamento ficam bloqueados ate fazer upgrade ou liberar espaco.`
            : `Você esta usando >=80% de ${labels}. Considere fazer upgrade ou limpar documentos antigos.`}
        </p>
        <p className="text-xs">
          {formatBytes(usage.storage.bytes)} / {formatBytes(usage.storage.max)} ·{' '}
          {usage.documents.count} / {usage.documents.max} docs ·{' '}
          {usage.embeddingsThisMonth.tokens.toLocaleString()} /{' '}
          {usage.embeddingsThisMonth.max.toLocaleString()} tokens
        </p>
      </AlertDescription>
    </Alert>
  );
}
