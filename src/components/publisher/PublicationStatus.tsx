import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCampaignPublication } from '@/hooks/use-campaign-publisher';
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from 'lucide-react';

const STEP_LABELS: Record<string, string> = {
  creating_campaign: 'Criando campanha...',
  creating_adset: 'Criando Ad Set...',
  creating_creative: 'Criando criativo...',
  creating_ad: 'Criando anúncio...',
};

const STATUS_LABELS: Record<string, string> = {
  validating: 'Validando...',
  compliance_check: 'Analisando compliance...',
  publishing: 'Publicando na Meta...',
  live: 'Campanha publicada!',
  failed: 'Falha na públicação',
};

interface Props {
  publicationId: string;
  onDone?: () => void;
}

export function PublicationStatus({ publicationId, onDone }: Props) {
  const { data: pub, isLoading } = useCampaignPublication(publicationId);

  if (isLoading || !pub) {
    return (
      <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></CardContent></Card>
    );
  }

  const isDone = pub.status === 'live' || pub.status === 'failed';
  const mainLabel = pub.current_step ? STEP_LABELS[pub.current_step] : STATUS_LABELS[pub.status];

  return (
    <Card>
      <CardContent className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          {!isDone ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
            : pub.status === 'live' ? <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              : <XCircle className="w-8 h-8 text-red-400" />}
          <div>
            <div className="text-lg font-semibold">{mainLabel}</div>
            <div className="text-sm text-muted-foreground">{pub.name}</div>
          </div>
        </div>

        {/* Progress steps */}
        <div className="space-y-2">
          {[
            { key: 'validating', label: 'Validação Zod' },
            { key: 'compliance_check', label: 'Compliance Gate' },
            { key: 'publishing', label: 'Publicando na Meta (4 passos)' },
          ].map((s) => {
            const done = pub.status === 'live'
              || (pub.status === 'failed' && pub.error_stage && ['validation', 'compliance', 'auth'].includes(pub.error_stage) && pub.error_stage !== s.key);
            const current = pub.status === s.key;
            return (
              <div key={s.key} className="flex items-center gap-3">
                {current ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  : done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                <span className={`text-sm ${current ? 'font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Compliance score */}
        {pub.compliance_score != null && (
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Score Compliance</div>
            <div className="text-2xl font-bold">{pub.compliance_score}/100</div>
          </div>
        )}

        {/* Meta IDs */}
        {pub.status === 'live' && pub.meta_campaign_id && (
          <div className="space-y-1 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
            <div className="text-xs text-emerald-300">IDs criados na Meta</div>
            <div className="text-xs font-mono text-muted-foreground">
              Campaign: {pub.meta_campaign_id}<br />
              Ad Set: {pub.meta_adset_id}<br />
              Ad: {pub.meta_ad_id}
            </div>
            <a
              href={`https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${pub.meta_campaign_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
            >
              Abrir no Gerenciador <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Error */}
        {pub.status === 'failed' && (
          <div className="p-3 rounded-lg border bg-red-500/5 border-red-500/20 space-y-1">
            <div className="text-xs text-red-300">Erro em: {pub.error_stage}</div>
            <div className="text-sm text-red-200">{pub.error_message}</div>
            {pub.error_stage && !['validation', 'compliance', 'auth'].includes(pub.error_stage) && (
              <div className="text-xs text-muted-foreground">Rollback executado — nenhum dado ficou na Meta.</div>
            )}
          </div>
        )}

        {isDone && (
          <Button variant="outline" onClick={onDone}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        )}
      </CardContent>
    </Card>
  );
}
