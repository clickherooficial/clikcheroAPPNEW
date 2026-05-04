// ab-testing (Sprint 7/8) — View "A/B Tests".
import { useState } from 'react';
import { GitBranch, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useABTests, useStartABTest } from '@/hooks/use-ab-tests';
import { useToast } from '@/hooks/use-toast';
import { ABTestCard } from './ab-testing/ABTestCard';
import type { ABTestCriterion, ABTestKind } from '@/types/ab-tests';

const ABTestsView = () => {
  const { data: tests = [], isLoading, error } = useABTests();
  const start = useStartABTest();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [aKind, setAKind] = useState<ABTestKind>('campaign');
  const [aId, setAId] = useState('');
  const [aLabel, setALabel] = useState('');
  const [bKind, setBKind] = useState<ABTestKind>('campaign');
  const [bId, setBId] = useState('');
  const [bLabel, setBLabel] = useState('');
  const [criterion, setCriterion] = useState<ABTestCriterion>('ctr');

  const reset = () => {
    setName(''); setAId(''); setALabel(''); setBId(''); setBLabel('');
    setAKind('campaign'); setBKind('campaign'); setCriterion('ctr');
  };

  const submit = () => {
    if (!name || !aId || !bId) {
      toast({ title: 'Preencha nome e os 2 external_ids', variant: 'destructive' });
      return;
    }
    start.mutate(
      {
        name,
        variant_a_kind: aKind,
        variant_a_external_id: aId,
        variant_a_label: aLabel || undefined,
        variant_b_kind: bKind,
        variant_b_external_id: bId,
        variant_b_label: bLabel || undefined,
        criterion,
      },
      {
        onSuccess: () => {
          toast({ title: 'A/B test iniciado' });
          setCreateOpen(false);
          reset();
        },
        onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
      },
    );
  };

  const active = tests.filter((t) => !t.ended_at);
  const ended = tests.filter((t) => t.ended_at);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">A/B Tests</h1>
            <p className="text-xs text-muted-foreground">
              Compare 2 variantes lado a lado. Heurística: 10% diff + amostra mínima 30 conversões / 100 cliques pra CTR.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo teste
        </Button>
      </div>

      {isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}
      {error && (
        <Card className="p-6 flex items-center gap-3 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm">{(error as Error).message}</span>
        </Card>
      )}
      {!isLoading && tests.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum A/B test ainda. Clique "Novo teste" para parear 2 campanhas/adsets/ads existentes.
        </Card>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Em andamento</h2>
          {active.map((t) => <ABTestCard key={t.id} test={t} />)}
        </section>
      )}

      {ended.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Encerrados</h2>
          {ended.map((t) => <ABTestCard key={t.id} test={t} />)}
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => !o && (setCreateOpen(false), reset())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo A/B test</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ex: "Headline curta vs longa"' />
            </div>
            <div>
              <Label className="text-xs">Critério</Label>
              <Select value={criterion} onValueChange={(v) => setCriterion(v as ABTestCriterion)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ctr">CTR</SelectItem>
                  <SelectItem value="cpl">CPL</SelectItem>
                  <SelectItem value="roas">ROAS</SelectItem>
                  <SelectItem value="conversions">Conversões totais</SelectItem>
                  <SelectItem value="spend_efficiency">Eficiência de gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Variante A</Label>
                <Select value={aKind} onValueChange={(v) => setAKind(v as ABTestKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="adset">Adset</SelectItem>
                    <SelectItem value="ad">Ad</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="External ID" value={aId} onChange={(e) => setAId(e.target.value)} />
                <Input placeholder="Label (opcional)" value={aLabel} onChange={(e) => setALabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Variante B</Label>
                <Select value={bKind} onValueChange={(v) => setBKind(v as ABTestKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="adset">Adset</SelectItem>
                    <SelectItem value="ad">Ad</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="External ID" value={bId} onChange={(e) => setBId(e.target.value)} />
                <Input placeholder="Label (opcional)" value={bLabel} onChange={(e) => setBLabel(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={start.isPending}>
              {start.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ABTestsView;
