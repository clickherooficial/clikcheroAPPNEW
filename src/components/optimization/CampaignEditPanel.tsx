// meta-edits-suite (Sprint 2/8) — panel de edicao inline de campanha.
// 4 sub-secoes: Status, Budget, Bid, Schedule.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useUpdateCampaign } from '@/hooks/use-meta-edits';
import { useToast } from '@/hooks/use-toast';
import { ImpactPreviewBadge } from './ImpactPreviewBadge';
import type { BidStrategy, CampaignStatus, UpdateCampaignPayload } from '@/types/meta-edits';
import { Loader2 } from 'lucide-react';

interface Campaign {
  id: string;
  external_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_strategy: string | null;
  start_time: string | null;
  stop_time: string | null;
}

interface Props { campaign: Campaign; onClose?: () => void; }

export function CampaignEditPanel({ campaign, onClose }: Props) {
  const [name, setName] = useState(campaign.name);
  const [status, setStatus] = useState<CampaignStatus>((campaign.status as CampaignStatus) ?? 'PAUSED');
  const [dailyBudget, setDailyBudget] = useState<number | ''>(campaign.daily_budget ?? '');
  const [bidStrategy, setBidStrategy] = useState<BidStrategy | ''>((campaign.bid_strategy as BidStrategy) ?? '');
  const [startTime, setStartTime] = useState(campaign.start_time?.slice(0, 16) ?? '');
  const [stopTime, setStopTime] = useState(campaign.stop_time?.slice(0, 16) ?? '');

  const update = useUpdateCampaign();
  const { toast } = useToast();

  const submit = () => {
    const payload: UpdateCampaignPayload = { campaign_id: campaign.id };
    if (name !== campaign.name) payload.name = name;
    if (status !== campaign.status) payload.status = status;
    if (dailyBudget !== '' && dailyBudget !== campaign.daily_budget) payload.daily_budget = Number(dailyBudget);
    if (bidStrategy && bidStrategy !== campaign.bid_strategy) payload.bid_strategy = bidStrategy;
    if (startTime && startTime !== campaign.start_time?.slice(0, 16)) payload.start_time = new Date(startTime).toISOString();
    if (stopTime && stopTime !== campaign.stop_time?.slice(0, 16)) payload.stop_time = new Date(stopTime).toISOString();

    if (Object.keys(payload).length <= 1) {
      toast({ title: 'Nada pra salvar', description: 'Nenhum campo foi alterado.' });
      return;
    }

    update.mutate(payload, {
      onSuccess: (data) => {
        toast({
          title: data.sandbox ? 'Edição simulada (sandbox)' : 'Campanha atualizada',
          description: data.sandbox
            ? 'Sandbox ligado — nenhuma chamada real ao Meta. Ledger registrado.'
            : `${data.fields_updated.length} campo(s) sincronizado(s) com Meta.`,
        });
        onClose?.();
      },
      onError: (err: Error) => {
        toast({
          title: 'Falha ao atualizar',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  const newDaily = dailyBudget === '' ? null : Number(dailyBudget);

  return (
    <Card className="p-4 space-y-4 border-l-2 border-l-primary/40">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={250} />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="PAUSED">PAUSED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Daily budget (R$)</Label>
        <div className="flex items-center gap-3">
          <Input
            type="number" min={5} step={1}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value === '' ? '' : Number(e.target.value))}
            className="max-w-[140px]"
          />
          <ImpactPreviewBadge campaignId={campaign.id} newDailyBudget={newDaily} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bid strategy</Label>
          <Select value={bidStrategy} onValueChange={(v) => setBidStrategy(v as BidStrategy)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest cost (sem cap)</SelectItem>
              <SelectItem value="LOWEST_COST_WITH_BID_CAP">Lowest cost (com bid cap)</SelectItem>
              <SelectItem value="COST_CAP">Cost cap</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start</Label>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Stop</Label>
          <Input type="datetime-local" value={stopTime} onChange={(e) => setStopTime(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onClose && <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
        <Button onClick={submit} disabled={update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </Card>
  );
}
