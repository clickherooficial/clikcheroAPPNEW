// audience-management (Sprint 3/8) — selecao de origem + ratio + country pra LAL.
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudiences } from '@/hooks/use-audiences';
import type { LookalikeRatio, MetaAudience } from '@/types/audiences';

interface Props {
  value: { name: string; originId: string; country: string; ratio: LookalikeRatio } | null;
  onChange: (v: { name: string; originId: string; country: string; ratio: LookalikeRatio } | null) => void;
}

const RATIOS: LookalikeRatio[] = [0.01, 0.02, 0.05, 0.10];
const COUNTRIES = [
  { iso: 'BR', label: 'Brasil' },
  { iso: 'US', label: 'EUA' },
  { iso: 'PT', label: 'Portugal' },
  { iso: 'AR', label: 'Argentina' },
  { iso: 'MX', label: 'Mexico' },
  { iso: 'CO', label: 'Colombia' },
  { iso: 'ES', label: 'Espanha' },
];

export function LookalikePicker({ value, onChange }: Props) {
  const { data: audiences = [] } = useAudiences();
  const eligible = useMemo(
    () => (audiences as MetaAudience[]).filter((a) => a.subtype === 'CUSTOM'),
    [audiences],
  );
  const [name, setName] = useState(value?.name ?? '');
  const [originId, setOriginId] = useState(value?.originId ?? '');
  const [country, setCountry] = useState(value?.country ?? 'BR');
  const [ratio, setRatio] = useState<LookalikeRatio>(value?.ratio ?? 0.01);

  const update = (next: Partial<{ name: string; originId: string; country: string; ratio: LookalikeRatio }>) => {
    const merged = {
      name: next.name ?? name,
      originId: next.originId ?? originId,
      country: next.country ?? country,
      ratio: next.ratio ?? ratio,
    };
    if (next.name !== undefined) setName(merged.name);
    if (next.originId !== undefined) setOriginId(merged.originId);
    if (next.country !== undefined) setCountry(merged.country);
    if (next.ratio !== undefined) setRatio(merged.ratio);
    onChange(merged.name && merged.originId ? merged : null);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome da Lookalike</Label>
        <Input
          placeholder='Ex: "LAL 1% BR — compradores"'
          value={name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={80}
        />
      </div>
      <div>
        <Label className="text-xs">Audiencia origem (Custom)</Label>
        <Select value={originId} onValueChange={(v) => update({ originId: v })}>
          <SelectTrigger><SelectValue placeholder="Escolha uma audiencia" /></SelectTrigger>
          <SelectContent>
            {eligible.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma Custom Audience encontrada — sincronize ou crie uma.</div>}
            {eligible.map((a) => {
              const lo = a.approximate_count_lower_bound ?? 0;
              const tooSmall = lo > 0 && lo < 100;
              return (
                <SelectItem key={a.id} value={a.id} disabled={tooSmall}>
                  {a.name} {tooSmall && <span className="text-destructive">(&lt;100, nao elegivel)</span>}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Pais</Label>
          <Select value={country} onValueChange={(v) => update({ country: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => <SelectItem key={c.iso} value={c.iso}>{c.label} ({c.iso})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tamanho (ratio)</Label>
          <Select value={String(ratio)} onValueChange={(v) => update({ ratio: Number(v) as LookalikeRatio })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RATIOS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {(r * 100).toFixed(0)}% {r === 0.01 && '(mais similar)'} {r === 0.10 && '(mais alcance)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
