import { Target, ShoppingCart, Users, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

const OBJECTIVES = [
  { key: 'OUTCOME_LEADS', label: 'Leads', description: 'Capturar contatos qualificados', icon: Users, color: 'text-blue-400 bg-blue-500/10' },
  { key: 'OUTCOME_SALES', label: 'Vendas', description: 'Converter em vendas diretas', icon: ShoppingCart, color: 'text-emerald-400 bg-emerald-500/10' },
  { key: 'OUTCOME_TRAFFIC', label: 'Trafego', description: 'Atrair visitantes ao site', icon: Target, color: 'text-amber-400 bg-amber-500/10' },
  { key: 'OUTCOME_ENGAGEMENT', label: 'Engajamento', description: 'Aumentar interações', icon: Heart, color: 'text-pink-400 bg-pink-500/10' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ObjectiveStep({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Qual e o seu objetivo?</h3>
        <p className="text-sm text-muted-foreground">A IA vai calcular o orçamento ideal baseado nisso.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OBJECTIVES.map((obj) => {
          const Icon = obj.icon;
          const selected = value === obj.key;
          return (
            <button
              key={obj.key}
              onClick={() => onChange(obj.key)}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all',
                selected ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              )}
            >
              <div className={cn('p-2 rounded-lg', obj.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{obj.label}</div>
                <div className="text-xs text-muted-foreground">{obj.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
