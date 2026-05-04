import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const UNIT_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'leads',
  OUTCOME_SALES: 'vendas',
  OUTCOME_TRAFFIC: 'visitantes',
  OUTCOME_ENGAGEMENT: 'interações',
};

interface Props {
  objective: string;
  value: number;
  onChange: (v: number) => void;
}

export function GoalInputStep({ objective, value, onChange }: Props) {
  const unit = UNIT_LABELS[objective] ?? 'conversões';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Quantos {unit} você quer por semana?</h3>
        <p className="text-sm text-muted-foreground">Defina uma meta realista para a IA calcular o investimento.</p>
      </div>

      <div className="space-y-2">
        <Label>Meta semanal</Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={100000}
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) onChange(v);
            }}
            className="text-2xl font-bold h-14 flex-1"
          />
          <span className="text-lg text-muted-foreground">{unit}/semana</span>
        </div>
      </div>

      <div className="flex gap-2">
        {[10, 50, 100, 500, 1000].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="px-3 py-1.5 rounded-md border bg-muted/50 hover:bg-muted text-xs font-medium"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
