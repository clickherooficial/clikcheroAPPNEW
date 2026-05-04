// meta-edits-suite (Sprint 2/8) — dialog pra mover R$X de uma entidade pra outra.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useShiftBudget } from '@/hooks/use-meta-edits';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';

interface CampaignOption { id: string; name: string; daily_budget: number | null; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: CampaignOption[];
  initialFromId?: string;
}

export function BudgetShiftDialog({ open, onOpenChange, candidates, initialFromId }: Props) {
  const [fromId, setFromId] = useState<string>(initialFromId ?? '');
  const [toId, setToId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');

  const shift = useShiftBudget();
  const { toast } = useToast();

  const submit = () => {
    if (!fromId || !toId || !amount || fromId === toId) {
      toast({ title: 'Preencha origem, destino e valor (diferentes)', variant: 'destructive' });
      return;
    }
    shift.mutate(
      {
        from_entity_kind: 'campaign',
        from_entity_id: fromId,
        to_entity_kind: 'campaign',
        to_entity_id: toId,
        amount_brl: Number(amount),
      },
      {
        onSuccess: (data) => {
          toast({
            title: data.sandbox ? 'Shift simulado (sandbox)' : 'Budget movido',
            description: `R$${amount} transferido.`,
          });
          onOpenChange(false);
          setFromId(''); setToId(''); setAmount('');
        },
        onError: (err: Error) => toast({ title: 'Falha no shift', description: err.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Realocar budget <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (R${c.daily_budget ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Para</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>
                  {candidates.filter((c) => c.id !== fromId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (R${c.daily_budget ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number" min={1} step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={shift.isPending}>
            {shift.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
