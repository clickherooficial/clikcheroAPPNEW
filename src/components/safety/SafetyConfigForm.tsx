import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useUpdateSafetyConfig } from '@/hooks/use-safety';
import { SAFETY_LIMITS, type SafetyConfig, type SafetyConfigPatch } from '@/types/safety';

interface Props {
  config: SafetyConfig;
}

export function SafetyConfigForm({ config }: Props) {
  const update = useUpdateSafetyConfig();
  const [patch, setPatch] = useState<SafetyConfigPatch>({});
  const [confirmDisableSandbox, setConfirmDisableSandbox] = useState(false);

  useEffect(() => {
    setPatch({});
    setConfirmDisableSandbox(false);
  }, [config.updated_at]);

  const merged = { ...config, ...patch };
  const dirty = Object.keys(patch).length > 0;

  const set = <K extends keyof SafetyConfigPatch>(k: K, v: SafetyConfigPatch[K]) => {
    setPatch((p) => ({ ...p, [k]: v }));
  };

  const submit = () => {
    if (!dirty) return;
    if (patch.sandbox_mode === false && !confirmDisableSandbox) {
      setConfirmDisableSandbox(true);
      return;
    }
    update.mutate(patch);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Modos de operacao</CardTitle>
          <CardDescription>
            Sandbox ON simula acoes sem mexer no Meta. Auto-execucao OFF exige aprovacao em tudo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Modo simulacao (sandbox)"
            description="Quando ligado, todas as acoes sao logadas mas NAO chamam Meta API"
            checked={merged.sandbox_mode}
            onCheckedChange={(v) => set('sandbox_mode', v)}
          />
          {patch.sandbox_mode === false && !confirmDisableSandbox && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Voce esta prestes a desligar o sandbox. As proximas acoes vao mexer em dinheiro real
                no Meta Ads. Clique em "Salvar mudancas" novamente pra confirmar.
              </AlertDescription>
            </Alert>
          )}
          <ToggleRow
            label="Auto-execucao do agente"
            description="Quando ligado, agente executa acoes ate o limite de aprovacao. Quando desligado, tudo passa por approval"
            checked={merged.auto_execute_enabled}
            onCheckedChange={(v) => set('auto_execute_enabled', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limites de execucao</CardTitle>
          <CardDescription>
            Quantas acoes o agente pode executar por hora/dia, e qual aumento de gasto e aceitavel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderRow
            label="Acoes por hora"
            value={merged.max_actions_per_hour}
            onChange={(v) => set('max_actions_per_hour', v)}
            min={SAFETY_LIMITS.max_actions_per_hour.min}
            max={50}
            unit="acoes/h"
          />
          <SliderRow
            label="Acoes por dia"
            value={merged.max_actions_per_day}
            onChange={(v) => set('max_actions_per_day', v)}
            min={SAFETY_LIMITS.max_actions_per_day.min}
            max={500}
            unit="acoes/dia"
          />
          <SliderRow
            label="Aumento de gasto cumulativo (24h)"
            value={merged.max_spend_increase_pct_per_day}
            onChange={(v) => set('max_spend_increase_pct_per_day', v)}
            min={0}
            max={100}
            unit="%"
          />
          <NumberRow
            label="Acoes acima de R$ exigem aprovacao manual"
            value={merged.require_approval_above_brl}
            onChange={(v) => set('require_approval_above_brl', v)}
            unit="R$"
            description="Mesmo com auto-execucao ligada, acoes mais caras viram approval pendente"
          />
          <NumberRow
            label="Falhas seguidas pra disparar circuit breaker"
            value={merged.circuit_breaker_threshold}
            onChange={(v) => set('circuit_breaker_threshold', v)}
            unit="falhas"
            description="Apos N falhas consecutivas o agente pausa automaticamente"
          />
          <NumberRow
            label="Cooldown apos breaker (minutos)"
            value={merged.circuit_breaker_cooldown_minutes}
            onChange={(v) => set('circuit_breaker_cooldown_minutes', v)}
            unit="min"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setPatch({})}>
            Cancelar
          </Button>
        )}
        <Button
          onClick={submit}
          disabled={!dirty || update.isPending}
          className="min-w-32"
        >
          {update.isPending ? 'Salvando...' : 'Salvar mudancas'}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono font-semibold">
          {value} {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={1}
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  unit,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="max-w-32 font-mono"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
