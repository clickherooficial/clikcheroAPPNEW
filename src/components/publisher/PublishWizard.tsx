import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Rocket, Loader2, Check } from 'lucide-react';
import { CampaignStep, type CampaignData } from './CampaignStep';
import { AdsetStep, type AdsetData } from './AdsetStep';
import { AdStep, type AdData } from './AdStep';
import { PublishConfirmModal } from './PublishConfirmModal';
import { PublicationStatus } from './PublicationStatus';
import { useCampaignPublish } from '@/hooks/use-campaign-publisher';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const DEFAULT_CAMPAIGN: CampaignData = {
  name: '',
  objective: 'OUTCOME_TRAFFIC',
  status: 'PAUSED',
  buying_type: 'AUCTION',
  special_ad_categories: [],
};

const DEFAULT_ADSET: AdsetData = {
  name: '',
  daily_budget: 1000, // R$ 10,00 (centavos)
  targeting: {
    geo_locations: { countries: ['BR'] },
    age_min: 18,
    age_max: 65,
  },
  optimization_goal: 'LINK_CLICKS',
  billing_event: 'IMPRESSIONS',
};

const DEFAULT_AD: AdData = {
  name: '',
  headline: '',
  body: '',
  cta: 'LEARN_MORE',
  link_url: '',
  page_id: '',
};

const STEPS = [
  { key: 'campaign', label: 'Campanha' },
  { key: 'adset', label: 'Ad Set' },
  { key: 'ad', label: 'Anúncio' },
];

export function PublishWizard({ onPublished }: { onPublished?: () => void }) {
  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState<CampaignData>(DEFAULT_CAMPAIGN);
  const [adset, setAdset] = useState<AdsetData>(DEFAULT_ADSET);
  const [ad, setAd] = useState<AdData>(DEFAULT_AD);
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [publicationId, setPublicationId] = useState<string | null>(null);

  const publish = useCampaignPublish();

  // Load ad accounts
  const { data: adAccounts } = useQuery<Array<{ account_id: string; account_name: string | null }>>({
    queryKey: ['ad-accounts-for-publish'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('account_id, account_name')
        .is('deleted_at', null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handlePublish = async (force: boolean) => {
    setShowConfirm(false);
    try {
      const result = await publish.mutateAsync({
        ad_account_id: adAccountId,
        campaign_data: campaign as unknown as Record<string, unknown>,
        adset_data: adset as unknown as Record<string, unknown>,
        ad_data: ad as unknown as Record<string, unknown>,
        force,
      });
      if (result.publication_id) setPublicationId(result.publication_id);
    } catch (err) {
      // A Edge Function retorna { publication_id, ... } no body de erros 400/422/502
      // FunctionsHttpError expoe o response via .context.response
      const ctx = (err as { context?: { response?: Response } }).context;
      let pubId: string | null = null;
      if (ctx?.response) {
        try {
          const body = await ctx.response.json();
          pubId = body?.publication_id ?? null;
        } catch { /* body nao-json */ }
      }
      if (pubId) {
        setPublicationId(pubId);
        return;
      }
      // Fallback: busca ultima publication do usuario atual
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.id) {
        const { data: lastPub } = await supabase
          .from('campaign_publications')
          .select('id')
          .eq('created_by', userData.user.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastPub?.id) setPublicationId(lastPub.id);
      }
    }
  };

  if (publicationId) {
    return (
      <PublicationStatus
        publicationId={publicationId}
        onDone={() => {
          setPublicationId(null);
          onPublished?.();
        }}
      />
    );
  }

  const canNext = () => {
    if (step === 0) return campaign.name.length > 0 && !!adAccountId;
    if (step === 1) return adset.name.length > 0 && (adset.daily_budget ?? 0) >= 1000;
    if (step === 2) return ad.name.length > 0 && ad.headline.length > 0 && ad.body.length > 0 && ad.link_url.length > 0 && ad.page_id.length > 0;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2',
              i < step ? 'bg-emerald-500 border-emerald-500 text-white'
                : i === step ? 'bg-primary border-primary text-white'
                  : 'border-muted text-muted-foreground'
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-sm font-medium', i === step ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className={cn('flex-1 h-0.5', i < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <CampaignStep
              data={campaign}
              onChange={setCampaign}
              adAccounts={adAccounts ?? []}
              adAccountId={adAccountId}
              onAdAccountChange={setAdAccountId}
            />
          )}
          {step === 1 && <AdsetStep data={adset} onChange={setAdset} />}
          {step === 2 && <AdStep data={ad} onChange={setAd} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0 || publish.isPending}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => setShowConfirm(true)} disabled={!canNext() || publish.isPending}>
            {publish.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Publicar
          </Button>
        )}
      </div>

      {showConfirm && (
        <PublishConfirmModal
          campaign={campaign}
          adset={adset}
          ad={ad}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handlePublish}
        />
      )}
    </div>
  );
}
