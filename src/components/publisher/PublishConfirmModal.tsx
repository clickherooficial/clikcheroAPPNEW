import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CampaignData } from './CampaignStep';
import type { AdsetData } from './AdsetStep';
import type { AdData } from './AdStep';
import { Rocket } from 'lucide-react';

interface Props {
  campaign: CampaignData;
  adset: AdsetData;
  ad: AdData;
  onCancel: () => void;
  onConfirm: (force: boolean) => void;
}

export function PublishConfirmModal({ campaign, adset, ad, onCancel, onConfirm }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Confirmar Públicação
          </DialogTitle>
          <DialogDescription>
            Revise antes de enviar para a Meta. O compliance engine analisara automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2 p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Campanha</span>
              <Badge variant="outline">{campaign.status}</Badge>
            </div>
            <div className="font-semibold">{campaign.name}</div>
            <div className="text-xs text-muted-foreground">Objetivo: {campaign.objective}</div>
          </div>

          <div className="space-y-1 p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Ad Set</div>
            <div className="font-semibold">{adset.name}</div>
            <div className="text-xs text-muted-foreground">
              R$ {((adset.daily_budget ?? 0) / 100).toFixed(2)}/dia •
              {' '}{adset.targeting.geo_locations.countries?.join(', ')} •
              {' '}{adset.targeting.age_min}-{adset.targeting.age_max} anos
            </div>
          </div>

          <div className="space-y-1 p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Anúncio</div>
            <div className="font-semibold">{ad.name}</div>
            <div className="text-sm">{ad.headline}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{ad.body}</div>
            <div className="text-xs text-muted-foreground">→ {ad.link_url}</div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(false)}>
            <Rocket className="w-4 h-4 mr-2" />
            Publicar com Compliance Gate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
