// Passo 4 — Tom de voz. Spec: briefing-onboarding (task 6.5)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TagInput } from '@/components/briefing/TagInput';
import type { EmotionalTone, ToneData, ToneScale } from '@/types/briefing';

interface Props {
  initial: ToneData;
  disabled?: boolean;
  mode?: 'wizard' | 'settings';
  onSubmit: (tone: ToneData) => void;
  onBack: () => void;
}

const EMOTIONAL_OPTIONS: { value: EmotionalTone; label: string }[] = [
  { value: 'aspirational', label: 'Aspiracional' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'welcoming', label: 'Acolhedor' },
  { value: 'authoritative', label: 'Autoritativo' },
  { value: 'fun', label: 'Divertido' },
  { value: 'rational', label: 'Racional' },
];

export function StepTone({ initial, disabled, mode = 'wizard', onSubmit, onBack }: Props) {
  const [formality, setFormality] = useState<ToneScale>(initial.formality ?? 3);
  const [technicality, setTechnicality] = useState<ToneScale>(initial.technicality ?? 3);
  const [emotional, setEmotional] = useState<EmotionalTone[]>(initial.emotional ?? []);
  const [ctas, setCtas] = useState<string[]>(initial.preferredCtas ?? []);
  const [forbidden, setForbidden] = useState<string[]>(initial.forbiddenPhrases ?? []);

  const toggleTone = (t: EmotionalTone) => {
    if (emotional.includes(t)) {
      setEmotional(emotional.filter((x) => x !== t));
    } else if (emotional.length < 3) {
      setEmotional([...emotional, t]);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Formalidade ({formality}/5)</Label>
        <p className="text-xs text-muted-foreground mb-2">1 = bem informal · 5 = bem formal</p>
        <Slider min={1} max={5} step={1} value={[formality]} onValueChange={(v) => setFormality((v[0] ?? 3) as ToneScale)} disabled={disabled} />
      </div>

      <div>
        <Label>Tecnicidade ({technicality}/5)</Label>
        <p className="text-xs text-muted-foreground mb-2">1 = simples · 5 = jargao técnico</p>
        <Slider min={1} max={5} step={1} value={[technicality]} onValueChange={(v) => setTechnicality((v[0] ?? 3) as ToneScale)} disabled={disabled} />
      </div>

      <div>
        <Label>Tom emocional dominante (escolha ate 3)</Label>
        <div className="flex flex-wrap gap-2 pt-2">
          {EMOTIONAL_OPTIONS.map((opt) => (
            <Badge
              key={opt.value}
              variant={emotional.includes(opt.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => !disabled && toggleTone(opt.value)}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label className="leading-snug">
          Que frases você sempre quer usar no final dos anúncios. Como você pede a venda para seu cliente?
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Adicione ate 10 trechos que funcionam como chamada final ou fechamento para o seu tipo de anúncio.
        </p>
        <TagInput value={ctas} onChange={setCtas} placeholder='Ex: "Quero garantir meu lugar"' disabled={disabled} max={10} />
      </div>

      <div>
        <Label>Frases ou palavras que você Não quer ver na sua copy</Label>
        <p className="text-xs text-muted-foreground mb-2">Termos batidos, claims arriscados ou palavras que não combinam com sua marca</p>
        <TagInput value={forbidden} onChange={setForbidden} placeholder="Ex: garantia, milagre, comprovado" disabled={disabled} max={20} />
      </div>

      <div className={mode === 'settings' ? 'flex justify-end pt-4' : 'flex justify-between pt-4'}>
        {mode !== 'settings' && (
          <Button variant="ghost" onClick={onBack} disabled={disabled}>Voltar</Button>
        )}
        <Button
          disabled={disabled}
          onClick={() =>
            onSubmit({
              formality,
              technicality,
              emotional,
              preferredCtas: ctas,
              forbiddenPhrases: forbidden,
            })
          }
        >
          {mode === 'settings' ? 'Salvar alteracoes' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
