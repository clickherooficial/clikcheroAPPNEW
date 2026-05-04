// meta-edits-suite (Sprint 2/8) — panel de edicao de ad (status/name/creative).
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useUpdateAd } from '@/hooks/use-meta-edits';
import { useToast } from '@/hooks/use-toast';
import type { CampaignStatus, UpdateAdPayload } from '@/types/meta-edits';
import { Loader2 } from 'lucide-react';

interface Ad {
  id?: string;
  external_id: string;
  name: string;
  status: string;
  creative_external_id?: string;
}

interface Props { ad: Ad; onClose?: () => void; }

export function AdEditPanel({ ad, onClose }: Props) {
  const [name, setName] = useState(ad.name);
  const [status, setStatus] = useState<CampaignStatus>((ad.status as CampaignStatus) ?? 'PAUSED');
  const [creativeId, setCreativeId] = useState(ad.creative_external_id ?? '');

  const update = useUpdateAd();
  const { toast } = useToast();

  const submit = () => {
    const payload: UpdateAdPayload = ad.id ? { ad_id: ad.id } : { ad_external_id: ad.external_id };
    if (name !== ad.name) payload.name = name;
    if (status !== ad.status) payload.status = status;
    if (creativeId && creativeId !== ad.creative_external_id) payload.creative_id = creativeId;

    if (Object.keys(payload).length <= 1) {
      toast({ title: 'Nada pra salvar' });
      return;
    }

    update.mutate(payload, {
      onSuccess: (data) => {
        toast({ title: data.sandbox ? 'Ad simulado (sandbox)' : 'Ad atualizado' });
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
          <Label className="text-xs">Creative external id</Label>
          <Input value={creativeId} onChange={(e) => setCreativeId(e.target.value)} placeholder="opcional" />
        </div>
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
