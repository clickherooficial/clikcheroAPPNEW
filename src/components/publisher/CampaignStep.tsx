import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CampaignData {
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED';
  buying_type: 'AUCTION' | 'RESERVED';
  special_ad_categories: string[];
  start_time?: string;
  stop_time?: string;
}

const OBJECTIVES: Record<string, string> = {
  OUTCOME_SALES: 'Vendas',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_AWARENESS: 'Reconhecimento de Marca',
  OUTCOME_TRAFFIC: 'Trafego',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_APP_PROMOTION: 'Promoção de App',
};

interface Props {
  data: CampaignData;
  onChange: (d: CampaignData) => void;
  adAccounts: Array<{ account_id: string; account_name: string | null }>;
  adAccountId: string;
  onAdAccountChange: (id: string) => void;
}

export function CampaignStep({ data, onChange, adAccounts, adAccountId, onAdAccountChange }: Props) {
  const set = <K extends keyof CampaignData>(k: K, v: CampaignData[K]) => onChange({ ...data, [k]: v });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Conta de Anúncios</Label>
        <Select value={adAccountId} onValueChange={onAdAccountChange}>
          <SelectTrigger><SelectValue placeholder="Selecione a ad account" /></SelectTrigger>
          <SelectContent>
            {adAccounts.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma conta. Conecte em Integrações.</div>}
            {adAccounts.map((a) => (
              <SelectItem key={a.account_id} value={a.account_id}>{a.account_name ?? a.account_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Nome da Campanha *</Label>
        <Input value={data.name} onChange={(e) => set('name', e.target.value)} maxLength={250} placeholder="Ex: Campanha lancamento verão" />
        <p className="text-xs text-muted-foreground">{data.name.length}/250</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Objetivo *</Label>
          <Select value={data.objective} onValueChange={(v) => set('objective', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(OBJECTIVES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status Inicial</Label>
          <Select value={data.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'PAUSED')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PAUSED">Pausada (recomendado)</SelectItem>
              <SelectItem value="ACTIVE">Ativa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Inicio (opcional)</Label>
          <Input type="datetime-local" value={data.start_time?.slice(0, 16) ?? ''} onChange={(e) => set('start_time', e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fim (opcional)</Label>
          <Input type="datetime-local" value={data.stop_time?.slice(0, 16) ?? ''} onChange={(e) => set('stop_time', e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
        💡 Comece com status PAUSED para revisar antes de ativar.
      </div>
    </div>
  );
}
