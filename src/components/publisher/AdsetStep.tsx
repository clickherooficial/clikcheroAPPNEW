import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AdsetData {
  name: string;
  daily_budget?: number;
  lifetime_budget?: number;
  targeting: {
    geo_locations: { countries?: string[] };
    age_min: number;
    age_max: number;
    genders?: number[];
    interests?: Array<{ id: string; name: string }>;
  };
  optimization_goal: string;
  billing_event: 'IMPRESSIONS' | 'LINK_CLICKS';
  start_time?: string;
}

const OPT_GOALS: Record<string, string> = {
  LINK_CLICKS: 'Cliques no Link',
  LANDING_PAGE_VIEWS: 'Visualizações de Página',
  CONVERSIONS: 'Conversões',
  REACH: 'Alcance',
  IMPRESSIONS: 'Impressoes',
  LEAD_GENERATION: 'Geração de Leads',
};

interface Props {
  data: AdsetData;
  onChange: (d: AdsetData) => void;
}

export function AdsetStep({ data, onChange }: Props) {
  const set = <K extends keyof AdsetData>(k: K, v: AdsetData[K]) => onChange({ ...data, [k]: v });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Nome do Ad Set *</Label>
        <Input value={data.name} onChange={(e) => set('name', e.target.value)} maxLength={400} placeholder="Ex: BR - 18-35 - Interesses Fitness" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Orçamento Diario (R$) *</Label>
          <Input
            type="number"
            min={10}
            step={0.01}
            value={data.daily_budget ? (data.daily_budget / 100).toFixed(2) : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              set('daily_budget', isNaN(val) ? undefined : Math.round(val * 100));
            }}
            placeholder="10.00"
          />
          <p className="text-xs text-muted-foreground">Mínimo R$ 10,00 (limite Meta para BRL)</p>
        </div>
        <div className="space-y-1.5">
          <Label>Objetivo de Otimização</Label>
          <Select value={data.optimization_goal} onValueChange={(v) => set('optimization_goal', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(OPT_GOALS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Targeting</Label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Pais</Label>
            <Select
              value={data.targeting.geo_locations.countries?.[0] ?? 'BR'}
              onValueChange={(v) => onChange({ ...data, targeting: { ...data.targeting, geo_locations: { countries: [v] } } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BR">Brasil</SelectItem>
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="US">Estados Unidos</SelectItem>
                <SelectItem value="AR">Argentina</SelectItem>
                <SelectItem value="MX">Mexico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Idade Min</Label>
            <Input
              type="number"
              min={13}
              max={65}
              value={data.targeting.age_min}
              onChange={(e) => onChange({ ...data, targeting: { ...data.targeting, age_min: parseInt(e.target.value) || 18 } })}
            />
          </div>
          <div>
            <Label className="text-xs">Idade Max</Label>
            <Input
              type="number"
              min={13}
              max={65}
              value={data.targeting.age_max}
              onChange={(e) => onChange({ ...data, targeting: { ...data.targeting, age_max: parseInt(e.target.value) || 65 } })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cobranca por</Label>
        <Select value={data.billing_event} onValueChange={(v) => set('billing_event', v as 'IMPRESSIONS' | 'LINK_CLICKS')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IMPRESSIONS">Impressoes</SelectItem>
            <SelectItem value="LINK_CLICKS">Cliques no Link</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
