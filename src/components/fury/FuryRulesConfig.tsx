import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFuryRules } from '@/hooks/use-fury';
import { Loader2, Zap } from 'lucide-react';

const UNIT_LABELS: Record<string, string> = {
  frequency: 'frequencia',
  currency: 'R$',
  percent: '%',
  percent_budget: '% do orçamento',
  percent_below: '% abaixo do target',
};

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  pause: { label: 'Pausar', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  alert: { label: 'Alertar', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  suggest: { label: 'Sugerir', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

export function FuryRulesConfig() {
  const { rules, isLoading, updateRule } = useFuryRules();

  if (isLoading) {
    return <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Nenhuma regra configurada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => {
        const actionStyle = ACTION_LABELS[rule.action_type] ?? ACTION_LABELS.alert;
        return (
          <Card key={rule.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    {rule.display_name}
                  </CardTitle>
                  <Badge variant="outline" className={`${actionStyle.className} border text-xs`}>
                    {actionStyle.label}
                  </Badge>
                </div>
                <Switch
                  checked={rule.is_enabled}
                  onCheckedChange={(v) => updateRule.mutate({ id: rule.id, is_enabled: v })}
                />
              </div>
              {rule.description && (
                <CardDescription>{rule.description}</CardDescription>
              )}
            </CardHeader>
            {rule.is_enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Threshold ({UNIT_LABELS[rule.threshold_unit] ?? rule.threshold_unit})</Label>
                    <Input
                      type="number"
                      defaultValue={rule.threshold_value}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0 && val !== rule.threshold_value) {
                          updateRule.mutate({ id: rule.id, threshold_value: val });
                        }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias consecutivos</Label>
                    <Input
                      type="number"
                      defaultValue={rule.consecutive_days}
                      min={1}
                      max={7}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= 7 && val !== rule.consecutive_days) {
                          updateRule.mutate({ id: rule.id, consecutive_days: val });
                        }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Executar automaticamente</Label>
                    <div className="flex items-center h-8">
                      <Switch
                        checked={rule.auto_execute}
                        onCheckedChange={(v) => updateRule.mutate({ id: rule.id, auto_execute: v })}
                      />
                      <span className="ml-2 text-xs text-muted-foreground">
                        {rule.auto_execute ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
