// pixel-engagement-audiences (Sprint 4/8) — UI builder pra Pixel Custom Audience.
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAudienceSources } from '@/hooks/use-audience-sources';
import type { CreatePixelAudiencePayload, PixelEvent } from '@/types/pixel-audiences';

const EVENTS: PixelEvent[] = [
  'PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration',
  'ViewContent', 'AddPaymentInfo', 'InitiateCheckout', 'Search', 'Subscribe',
];

interface Props {
  value: CreatePixelAudiencePayload | null;
  onChange: (v: CreatePixelAudiencePayload | null) => void;
}

export function PixelRuleBuilder({ value, onChange }: Props) {
  const { data: sources = [], isLoading } = useAudienceSources();
  const pixels = sources.filter((s) => s.kind === 'pixel');

  const [name, setName] = useState(value?.name ?? '');
  const [pixelId, setPixelId] = useState(value?.pixel_id ?? '');
  const [event, setEvent] = useState<PixelEvent>(value?.event ?? 'PageView');
  const [urlContains, setUrlContains] = useState(value?.url_contains ?? '');
  const [retentionDays, setRetentionDays] = useState<number>(value?.retention_days ?? 30);
  const [excludePurchase, setExcludePurchase] = useState(false);

  useEffect(() => {
    const valid = name && pixelId;
    if (!valid) { onChange(null); return; }
    const payload: CreatePixelAudiencePayload = {
      name,
      pixel_id: pixelId,
      event,
      retention_days: retentionDays,
    };
    if (urlContains) payload.url_contains = urlContains;
    if (excludePurchase && event !== 'Purchase') payload.exclude_event = 'Purchase';
    onChange(payload);
  }, [name, pixelId, event, urlContains, retentionDays, excludePurchase, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome da audiencia</Label>
        <Input
          placeholder='Ex: "Carrinho abandonado 14d"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </div>

      <div>
        <Label className="text-xs">Pixel</Label>
        <Select value={pixelId} onValueChange={setPixelId}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Carregando…' : 'Escolha um pixel'} />
          </SelectTrigger>
          <SelectContent>
            {pixels.length === 0 && !isLoading && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Nenhum pixel encontrado. Clique "Sincronizar" no painel.
              </div>
            )}
            {pixels.map((p) => (
              <SelectItem key={p.id} value={p.external_id}>
                {p.name}
                {(p.metadata as { last_fired_time?: string })?.last_fired_time && (
                  <span className="text-muted-foreground text-xs ml-2">
                    (last fired: {new Date((p.metadata as { last_fired_time: string }).last_fired_time).toLocaleDateString()})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Evento</Label>
          <Select value={event} onValueChange={(v) => setEvent(v as PixelEvent)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENTS.map((ev) => <SelectItem key={ev} value={ev}>{ev}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Retencao (dias, max 180)</Label>
          <Input
            type="number" min={1} max={180}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Math.min(180, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">URL contém (opcional)</Label>
        <Input
          placeholder='Ex: "/produto-x" — filtra eventos cuja URL contem essa string'
          value={urlContains}
          onChange={(e) => setUrlContains(e.target.value)}
        />
      </div>

      {event !== 'Purchase' && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-xs font-medium">Excluir compradores</Label>
            <p className="text-[10px] text-muted-foreground">
              Audiencia dispara {event} mas NAO disparou Purchase (clássico carrinho abandonado).
            </p>
          </div>
          <Switch checked={excludePurchase} onCheckedChange={setExcludePurchase} />
        </div>
      )}
    </div>
  );
}
