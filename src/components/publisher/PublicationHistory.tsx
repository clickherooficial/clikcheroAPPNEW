import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCampaignPublications, type CampaignPublication } from '@/hooks/use-campaign-publisher';
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  live: { label: 'Publicada', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Falhou', icon: XCircle, className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  publishing: { label: 'Publicando', icon: Clock, className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  compliance_check: { label: 'Compliance', icon: Clock, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  validating: { label: 'Validando', icon: Clock, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  draft: { label: 'Rascunho', icon: Clock, className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

export function PublicationHistory() {
  const [filter, setFilter] = useState<'all' | 'live' | 'failed'>('all');
  const { data: items, isLoading } = useCampaignPublications(filter);

  if (isLoading) {
    return <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Públicações recentes</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'live' | 'failed')}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="live">Publicadas</SelectItem>
            <SelectItem value="failed">Falhadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!items || items.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          Nenhuma públicação ainda.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((pub: CampaignPublication) => {
            const meta = STATUS_META[pub.status] ?? STATUS_META.draft;
            const Icon = meta.icon;
            return (
              <div key={pub.id} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className={`p-2 rounded-lg ${meta.className}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{pub.name}</span>
                    <Badge className={`${meta.className} border text-xs`}>{meta.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(pub.started_at), { addSuffix: true, locale: ptBR })}
                    {pub.compliance_score != null && ` • Score ${pub.compliance_score}/100`}
                  </div>
                  {pub.status === 'failed' && pub.error_message && (
                    <div className="text-xs text-red-300 mt-1 line-clamp-2">
                      {pub.error_stage}: {pub.error_message}
                    </div>
                  )}
                </div>
                {pub.meta_campaign_id && pub.status === 'live' && (
                  <a
                    href={`https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${pub.meta_campaign_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
