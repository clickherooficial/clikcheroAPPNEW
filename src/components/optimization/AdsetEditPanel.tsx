// meta-edits-suite (Sprint 2/8) — panel de edicao de adset.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useUpdateAdset } from '@/hooks/use-meta-edits';
import { useToast } from '@/hooks/use-toast';
import type { AdsetOptimizationGoal, CampaignStatus, UpdateAdsetPayload } from '@/types/meta-edits';
import { Loader2 } from 'lucide-react';

interface Adset {
  id: string;
  external_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  optimization_goal: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface Props { adset: Adset; onClose?: () => void; }

export function AdsetEditPanel({ adset, onClose }: Props) {
  const [name, setName] = useState(adset.name);
  const [status, setStatus] = useState<CampaignStatus>((adset.status as CampaignStatus) ?? 'PAUSED');
  const [dailyBudget, setDailyBudget] = useState<number | ''>(adset.daily_budget ?? '');
  const [goal, setGoal] = useState<AdsetOptimizationGoal | ''>((adset.optimization_goal as AdsetOptimizationGoal) ?? '');

  const update = useUpdateAdset();
  const { toast } = useToast();

  const submit = () => {
    const payload: UpdateAdsetPayload = { adset_id: adset.id };
    if (name !== adset.name) payload.name = name;
    if (status !== adset.status) payload.status = status;
    if (dailyBudget !== '' && dailyBudget !== adset.daily_budget) payload.daily_budget = Number(dailyBudget);
    if (goal && goal !== adset.optimization_goal) payload.optimization_goal = goal;

    if (Object.keys(payload).length <= 1) {
      toast({ title: 'Nada pra salvar' });
      return;
    }

    update.mutate(payload, {
      onSuccess: (data) => {
        toast({
          title: data.sandbox ? 'Adset simulado (sandbox)' : 'Adset atualizado',
          description: `${data.fields_updated.length} campo(s).`,
        });
        onClose?.();
      },
      onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
    });
  };

  return (
    <Card className="p-4 space-y-3 border-l-2 border-l-primary/40">
      <div>
        <Label className="text-xs">Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <Label className="text-xs">Daily (R$)</Label>
          <Input
            type="number" min={5}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Optimization goal</Label>
        <Select value={goal} onValueChange={(v) => setGoal(v as AdsetOptimizationGoal)}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {(['LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'LANDING_PAGE_VIEWS', 'POST_ENGAGEMENT', 'REACH', 'IMPRESSIONS'] as const).map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onClose && <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
        <Button onClick={submit} disabled={update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </Card>
  );
}
