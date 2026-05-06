// Modal de edicao de uma proposta de campanha.
// Spec: chat-publish-flow (task 5.3)

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMetaGeoSearch } from '@/hooks/use-meta-geo-search';
import type { CampaignProposalPayload, MetaCtaEnum } from '@/types/campaign-proposal';

const CTA_OPTIONS: Array<{ value: MetaCtaEnum; label: string }> = [
  { value: 'LEARN_MORE', label: 'Saiba Mais' },
  { value: 'SHOP_NOW', label: 'Comprar Agora' },
  { value: 'SIGN_UP', label: 'Cadastre-se' },
  { value: 'SUBSCRIBE', label: 'Inscrever-se' },
  { value: 'CONTACT_US', label: 'Fale Conosco' },
  { value: 'GET_OFFER', label: 'Aproveitar Oferta' },
  { value: 'BOOK_NOW', label: 'Reservar' },
  { value: 'DOWNLOAD', label: 'Baixar' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CampaignProposalPayload;
  onSave: (patch: Partial<CampaignProposalPayload>) => Promise<void>;
  isSaving: boolean;
}

function deriveInitialLocation(p: CampaignProposalPayload): string {
  const summary = p.audience_geo_summary?.trim();
  if (summary) return summary;
  const cities = p.audience.geo_locations.cities ?? [];
  if (cities.length > 0) return ''; // Tem city key mas sem label legivel — usuario pode digitar pra atualizar
  return '';
}

export function CampaignProposalEditor({ open, onOpenChange, initial, onSave, isSaving }: Props) {
  const { toast } = useToast();
  const { resolveCity, isResolving } = useMetaGeoSearch();
  const [budget, setBudget] = useState<string>(String(initial.daily_budget_brl));
  const [ageMin, setAgeMin] = useState<string>(String(initial.audience.age_min));
  const [ageMax, setAgeMax] = useState<string>(String(initial.audience.age_max));
  const [location, setLocation] = useState<string>(deriveInitialLocation(initial));
  const [headline, setHeadline] = useState(initial.copy.headline);
  const [body, setBody] = useState(initial.copy.body);
  const [description, setDescription] = useState(initial.copy.description ?? '');
  const [cta, setCta] = useState<MetaCtaEnum>(initial.copy.cta);

  const headlineOver = headline.length > 40;
  const bodyOver = body.length > 125;
  const descOver = description.length > 27;
  const budgetNum = Number(budget.replace(',', '.'));
  const ageMinNum = Number(ageMin);
  const ageMaxNum = Number(ageMax);
  const budgetInvalid = !Number.isFinite(budgetNum) || budgetNum < 10;
  const ageInvalid = ageMinNum < 13 || ageMinNum > 65 || ageMaxNum < 13 || ageMaxNum > 65 || ageMaxNum < ageMinNum;

  const canSave = !headlineOver && !bodyOver && !descOver && !budgetInvalid && !ageInvalid;

  const handleSave = async () => {
    const patch: Partial<CampaignProposalPayload> = {
      daily_budget_brl: budgetNum,
      audience: {
        ...initial.audience,
        age_min: ageMinNum,
        age_max: ageMaxNum,
      },
      copy: {
        ...initial.copy,
        headline,
        body,
        description: description.trim() ? description : undefined,
        cta,
      },
    };

    const initialLocation = deriveInitialLocation(initial).trim();
    const locationTrimmed = location.trim();
    if (locationTrimmed && locationTrimmed !== initialLocation) {
      const r = await resolveCity(locationTrimmed);
      if (!r.ok) {
        const desc = r.error.kind === 'not_found'
          ? `${r.error.message} Tente "Cidade, UF".`
          : r.error.message;
        toast({ title: 'Localidade nao resolvida', description: desc, variant: 'destructive' });
        return;
      }
      // Meta rejeita countries + cities juntos no geo_locations (sobreposição).
      // Quando setamos cities, omitimos countries.
      patch.audience = {
        ...patch.audience!,
        geo_locations: {
          cities: [{ key: r.value.key, radius: r.value.radius_km, distance_unit: 'kilometer' }],
        },
      };
      patch.audience_geo_summary = r.value.summary;
    }

    await onSave(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar proposta</DialogTitle>
          <DialogDescription>
            Ajuste o que quiser. As alterações são salvas na proposta — ainda não publicadas no Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget">Investimento/dia (R$)</Label>
              <Input
                id="budget"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                aria-invalid={budgetInvalid}
              />
              {budgetInvalid && <p className="text-xs text-destructive">Mínimo R$ 10</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age-min">Idade mín.</Label>
              <Input
                id="age-min"
                inputMode="numeric"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                aria-invalid={ageInvalid}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age-max">Idade máx.</Label>
              <Input
                id="age-max"
                inputMode="numeric"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                aria-invalid={ageInvalid}
              />
            </div>
          </div>
          {ageInvalid && <p className="text-xs text-destructive -mt-2">Idade entre 13 e 65 (máx ≥ mín)</p>}

          <div className="space-y-1.5">
            <Label htmlFor="location" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Localidade
            </Label>
            <Input
              id="location"
              placeholder="Ex: Belo Horizonte, MG (deixe vazio para manter)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Resolvemos no Meta ao salvar (raio padrão 25 km). Vazio mantém a localidade atual.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">
              Título <span className={headlineOver ? 'text-destructive' : 'text-muted-foreground'}>({headline.length}/40)</span>
            </Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              aria-invalid={headlineOver}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">
              Texto principal <span className={bodyOver ? 'text-destructive' : 'text-muted-foreground'}>({body.length}/125)</span>
            </Label>
            <Textarea
              id="body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={bodyOver}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descrição (opcional) <span className={descOver ? 'text-destructive' : 'text-muted-foreground'}>({description.length}/27)</span>
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={descOver}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cta">Botão de ação (CTA)</Label>
            <Select value={cta} onValueChange={(v) => setCta(v as MetaCtaEnum)}>
              <SelectTrigger id="cta"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || isResolving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving || isResolving}>
            {(isSaving || isResolving) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isResolving ? 'Resolvendo localidade…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
