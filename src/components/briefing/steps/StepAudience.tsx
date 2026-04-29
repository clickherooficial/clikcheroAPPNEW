// Passo 3 — Audiência. Spec: briefing-onboarding (task 6.4)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TagInput } from '@/components/briefing/TagInput';
import { cn } from '@/lib/utils';
import type { AudienceData } from '@/types/briefing';

interface Props {
  initial: AudienceData;
  disabled?: boolean;
  onSubmit: (audience: AudienceData) => void;
  onBack: () => void;
}

const CONSCIENCIA_DOR_OPTIONS = [
  {
    level: 1 as const,
    titulo: 'Quase não percebe',
    texto:
      'A pessoa nem chama de "problema" ainda: segue a rotina sem parar para entender uma dor clara.',
  },
  {
    level: 2 as const,
    titulo: 'Sente algo incômodo ou um sintoma',
    texto:
      'Percebe que algo incomoda ou está errado, mas ainda sem um nome certo nem urgência forte.',
  },
  {
    level: 3 as const,
    titulo: 'Já sabe que precisa resolver',
    texto:
      'Reconhece a frustração ou o obstáculo; conversa sobre isso com outras pessoas ou busca ajuda informal.',
  },
  {
    level: 4 as const,
    titulo: 'Entende o problema e estuda opções',
    texto:
      'Consome vídeos, artigos gratuitos ou conteúdos de ajuda — compara categorias; ainda pode não estar escolhendo marcas.',
  },
  {
    level: 5 as const,
    titulo: 'Já procura solução para comprar',
    texto:
      'Compara fornecedores, preços ou planos ativamente — está perto da decisão de compra.',
  },
] satisfies { level: 1 | 2 | 3 | 4 | 5; titulo: string; texto: string }[];

export function StepAudience({ initial, disabled, onSubmit, onBack }: Props) {
  const [ageMin, setAgeMin] = useState(initial.ageRange?.min ?? 18);
  const [ageMax, setAgeMax] = useState(initial.ageRange?.max ?? 45);
  const [gender, setGender] = useState<AudienceData['gender']>(initial.gender ?? 'mixed');
  const [country, setCountry] = useState(initial.location?.country ?? 'Brasil');
  const [state, setState] = useState(initial.location?.state ?? '');
  const [city, setCity] = useState(initial.location?.city ?? '');
  const [occupation, setOccupation] = useState(initial.occupation ?? '');
  const [income, setIncome] = useState<AudienceData['incomeRange']>(initial.incomeRange);
  const [awareness, setAwareness] = useState(initial.awarenessLevel ?? 3);
  const [interests, setInterests] = useState<string[]>(initial.interests ?? []);
  const [behaviors, setBehaviors] = useState<string[]>(initial.behaviors ?? []);
  const [samples, setSamples] = useState<string[]>(initial.languageSamples ?? []);

  const canSubmit = country.trim().length > 0 && ageMin > 0 && ageMax >= ageMin;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Idade mínima *</Label>
          <Input type="number" value={ageMin} onChange={(e) => setAgeMin(parseInt(e.target.value) || 0)} disabled={disabled} />
        </div>
        <div>
          <Label>Idade máxima *</Label>
          <Input type="number" value={ageMax} onChange={(e) => setAgeMax(parseInt(e.target.value) || 0)} disabled={disabled} />
        </div>
      </div>

      <div>
        <Label>Gênero predominante</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3"
          value={gender ?? 'mixed'}
          onChange={(e) => setGender(e.target.value as AudienceData['gender'])}
          disabled={disabled}
        >
          <option value="mixed">Misto</option>
          <option value="female">Feminino</option>
          <option value="male">Masculino</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>País *</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>Estado</Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Profissão típica</Label>
          <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>Faixa de renda</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3"
            value={income ?? ''}
            onChange={(e) => setIncome((e.target.value || undefined) as AudienceData['incomeRange'])}
            disabled={disabled}
          >
            <option value="">Não especificar</option>
            <option value="low">Baixa</option>
            <option value="mid">Média</option>
            <option value="high">Alta</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-base">Em que nível está o público sobre a dor ou necessidade?</Label>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Isso diz se a pessoa ainda está descobrindo o problema ou já veio para comprar. Marque o que mais parece com quem compra de você.
          </p>
        </div>
        <RadioGroup
          value={String(awareness)}
          onValueChange={(v) => setAwareness(Number.parseInt(v, 10) as 1 | 2 | 3 | 4 | 5)}
          disabled={disabled}
          className="gap-2"
          aria-labelledby="audience-awareness-heading"
        >
          <span id="audience-awareness-heading" className="sr-only">
            Nível de consciência sobre a dor ou necessidade
          </span>
          {CONSCIENCIA_DOR_OPTIONS.map((opt) => (
            <label
              key={opt.level}
              htmlFor={`audience-awareness-${opt.level}`}
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg border p-3 text-left transition-colors',
                'hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5',
                disabled && 'cursor-not-allowed opacity-70',
              )}
            >
              <RadioGroupItem
                value={String(opt.level)}
                id={`audience-awareness-${opt.level}`}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-baseline gap-2 font-medium leading-snug">
                  <span className="tabular-nums text-muted-foreground">Nível {opt.level}</span>
                  <span>— {opt.titulo}</span>
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{opt.texto}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label>Interesses</Label>
        <TagInput value={interests} onChange={setInterests} placeholder="Pressione enter para adicionar" disabled={disabled} max={20} />
      </div>

      <div>
        <Label>Comportamentos</Label>
        <TagInput value={behaviors} onChange={setBehaviors} placeholder="Ex: compra impulsiva, pesquisa muito" disabled={disabled} max={20} />
      </div>

      <div>
        <Label>Frases que o público costuma usar</Label>
        <TagInput value={samples} onChange={setSamples} placeholder='Ex: "to cansada de dieta"' disabled={disabled} max={20} />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={disabled}>Voltar</Button>
        <Button
          disabled={!canSubmit || disabled}
          onClick={() =>
            onSubmit({
              ageRange: { min: ageMin, max: ageMax },
              gender,
              location: { country: country.trim(), state: state.trim() || undefined, city: city.trim() || undefined },
              occupation: occupation.trim() || undefined,
              incomeRange: income,
              awarenessLevel: awareness as 1 | 2 | 3 | 4 | 5,
              interests,
              behaviors,
              languageSamples: samples,
            })
          }
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
