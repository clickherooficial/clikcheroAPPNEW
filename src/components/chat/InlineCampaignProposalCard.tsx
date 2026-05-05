// Card inline de proposta de campanha — renderizado no chat quando uma
// mensagem do agente contem `<campaign-proposal id="..."/>`.
//
// Spec: chat-publish-flow (task 5.2)
//
// Estados visuais:
//   pending_approval -> 3 botões (Publicar / Editar / Cancelar)
//   publishing       -> live view sobre useCampaignPublication (polling)
//   live             -> verde + link Meta Ads Manager
//   failed           -> vermelho + botão Tentar de novo
//   cancelled/expired -> disabled

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Rocket,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampaignProposal } from '@/hooks/use-campaign-proposal';
import { useCampaignPublication } from '@/hooks/use-campaign-publisher';
import { CampaignProposalEditor } from './CampaignProposalEditor';
import { navigateToView } from '@/lib/view-navigation';
import type { ComplianceSeverity, CampaignObjective, CampaignProposalPayload } from '@/types/campaign-proposal';

interface Props {
  proposalId: string;
  // Callback que injeta uma mensagem de SISTEMA na conversa pra disparar o LLM
  // (usado pelos botões Publicar e Cancelar).
  onSendSystemMessage?: (text: string) => void;
}

const OBJECTIVE_LABEL_LEIGO: Record<CampaignObjective, string> = {
  SALES: 'Vender mais',
  LEADS: 'Conseguir contatos',
  AWARENESS: 'Mais gente conhecer',
  TRAFFIC: 'Mais visitas no site',
  ENGAGEMENT: 'Mais interação',
};

function severityBadge(sev: ComplianceSeverity) {
  switch (sev) {
    case 'none':
    case 'low':
      return { Icon: ShieldCheck, label: 'Compliance OK', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'medium':
      return { Icon: ShieldAlert, label: 'Atenção', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'high':
      return { Icon: ShieldX, label: 'Bloqueado', className: 'bg-red-500/15 text-red-400 border-red-500/30' };
    case 'unknown':
    default:
      return { Icon: HelpCircle, label: 'Não verificado', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' };
  }
}

function audienceStatValue(p: CampaignProposalPayload): string {
  const ages = `${p.audience.age_min}–${p.audience.age_max} anos`;
  const geo = p.audience_geo_summary?.trim();
  if (geo) return `${ages}, ${geo}`;
  const hasCities = (p.audience.geo_locations.cities ?? []).length > 0;
  if (hasCities) return `${ages}, área local`;
  return `${ages}, BR`;
}

export function InlineCampaignProposalCard({ proposalId, onSendSystemMessage }: Props) {
  const { data: proposal, isLoading, cancel, isCancelling, edit, isEditing } = useCampaignProposal(proposalId);
  const [editorOpen, setEditorOpen] = useState(false);

  // Polling do publication so quando ja virou publishing
  const publicationId = proposal?.publication_id ?? null;
  const { data: publication } = useCampaignPublication(
    proposal?.status === 'publishing' || proposal?.status === 'live' || proposal?.status === 'failed'
      ? publicationId
      : null,
  );

  if (isLoading || !proposal) {
    return (
      <div className="max-w-3xl mx-auto w-full my-3">
        <Card className="bg-card border-border/60">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando proposta…
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = proposal.payload_jsonb;
  const compliance = (proposal.compliance_jsonb ?? {}) as { severity?: ComplianceSeverity; hits?: Array<{ text: string }> };
  const sev = compliance.severity ?? 'unknown';
  const sevBadge = severityBadge(sev);
  const isHighRisk = sev === 'high';
  const isCancelled = proposal.status === 'cancelled' || proposal.status === 'expired';
  const isLive = proposal.status === 'live' || publication?.status === 'live';
  const isFailed = proposal.status === 'failed' || publication?.status === 'failed';
  const isPublishing = proposal.status === 'publishing' && !isLive && !isFailed;

  const handlePublish = () => {
    if (isHighRisk) return;
    onSendSystemMessage?.(`[SISTEMA] Aprovo publicar a proposta ${proposalId}.`);
  };

  const handleRetry = () => {
    onSendSystemMessage?.(`[SISTEMA] Tente publicar novamente a proposta ${proposalId}.`);
  };

  const handleCancel = async () => {
    await cancel();
    onSendSystemMessage?.(`[SISTEMA] Proposta ${proposalId} cancelada pelo usuario.`);
  };

  const adAccountId = p.prereq.ad_account.account_id;
  // Meta Ads Manager deep link
  const metaAdsManagerUrl = `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace(/^act_/, '')}`;

  return (
    <div className="max-w-3xl mx-auto w-full my-3">
      <Card className={cn(
        'bg-card border-border/60 overflow-hidden',
        isLive && 'border-emerald-500/40',
        isFailed && 'border-red-500/40',
        isCancelled && 'opacity-60',
      )}>
        <CardContent className="p-0">
          <div className="flex">
            {/* Thumbnail */}
            <div className="w-32 h-32 shrink-0 bg-muted/30 overflow-hidden">
              {p.creative.media_url_at_propose && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.creative.media_url_at_propose}
                  alt="Criativo do anúncio"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 p-4 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">
                    Proposta de anúncio
                  </div>
                  <div className="font-semibold text-sm text-foreground truncate">{p.campaign_name}</div>
                </div>
                <Badge variant="outline" className={cn('shrink-0 gap-1 text-[10px] uppercase tracking-wider', sevBadge.className)}>
                  <sevBadge.Icon className="h-3 w-3" />
                  {sevBadge.label}
                </Badge>
              </div>

              <div className="space-y-1 text-[12px] text-muted-foreground">
                <div><strong className="text-foreground">{p.copy.headline}</strong></div>
                <div className="line-clamp-2">{p.copy.body}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                <Stat label="Objetivo" value={OBJECTIVE_LABEL_LEIGO[p.objective]} />
                <Stat label="Por dia" value={`R$ ${p.daily_budget_brl.toFixed(2).replace('.', ',')}`} />
                <Stat label="Público" value={audienceStatValue(p)} />
              </div>

              {sev === 'medium' && (compliance.hits ?? []).length > 0 && (
                <div className="mt-3 text-[11px] text-amber-400">
                  Atenção: {(compliance.hits ?? []).slice(0, 2).map((h) => h.text).join('; ')}
                </div>
              )}
              {isHighRisk && (
                <div className="mt-3 text-[11px] text-red-400">
                  Bloqueado por compliance. Edite o texto pra remover: {(compliance.hits ?? []).slice(0, 2).map((h) => h.text).join('; ')}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                {/* Estado: live */}
                {isLive && (
                  <>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Publicado
                    </Badge>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigateToView('painel')}>
                        Ver no Painel
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={metaAdsManagerUrl} target="_blank" rel="noreferrer">
                          Meta Ads Manager
                          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </a>
                      </Button>
                    </div>
                  </>
                )}

                {/* Estado: failed */}
                {isFailed && (
                  <>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                      <XCircle className="h-3 w-3" />
                      Falhou
                    </Badge>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {proposal.error_payload?.message ?? publication?.error_message ?? 'Erro desconhecido'}
                    </span>
                    <Button size="sm" onClick={handleRetry} className="ml-auto">
                      Tentar de novo
                    </Button>
                  </>
                )}

                {/* Estado: publishing */}
                {isPublishing && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Publicando…
                  </Badge>
                )}

                {/* Estado: cancelled/expired */}
                {isCancelled && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {proposal.status === 'expired' ? 'Expirou' : 'Cancelada'}
                  </Badge>
                )}

                {/* Estado: pending_approval */}
                {proposal.status === 'pending_approval' && (
                  <>
                    <Button
                      size="sm"
                      onClick={handlePublish}
                      disabled={isHighRisk}
                      className="bg-[linear-gradient(135deg,#cf6f03_0%,#e8850a_100%)] text-white hover:shadow-md"
                    >
                      <Rocket className="h-3.5 w-3.5 mr-1.5" />
                      Publicar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {editorOpen && (
        <CampaignProposalEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initial={p}
          onSave={edit}
          isSaving={isEditing}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-md px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-foreground font-medium truncate">{value}</div>
    </div>
  );
}
