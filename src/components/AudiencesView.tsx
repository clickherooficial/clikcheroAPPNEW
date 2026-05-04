// audience-management (Sprint 3/8) — View "Audiencias".
import { useState } from 'react';
import { Users, RefreshCw, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAudiences, useSyncAudiences, useUpdateAudience } from '@/hooks/use-audiences';
import { useToast } from '@/hooks/use-toast';
import { AudienceListRow } from './audiences/AudienceListRow';
import { CreateAudienceDialog } from './audiences/CreateAudienceDialog';
import { DeleteAudienceConfirm } from './audiences/DeleteAudienceConfirm';
import type { MetaAudience } from '@/types/audiences';

const AudiencesView = () => {
  const { data: audiences = [], isLoading, error } = useAudiences();
  const sync = useSyncAudiences();
  const update = useUpdateAudience();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MetaAudience | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetaAudience | null>(null);
  const [editName, setEditName] = useState('');
  const [editRetention, setEditRetention] = useState<number | ''>(180);

  const openEdit = (a: MetaAudience) => {
    setEditTarget(a);
    setEditName(a.name);
    setEditRetention(a.retention_days ?? 180);
  };

  const submitEdit = () => {
    if (!editTarget) return;
    update.mutate(
      {
        audience_id: editTarget.id,
        name: editName !== editTarget.name ? editName : undefined,
        retention_days: editRetention !== '' && editRetention !== editTarget.retention_days ? Number(editRetention) : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Audiencia atualizada' });
          setEditTarget(null);
        },
        onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
      },
    );
  };

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: (data: any) => {
        toast({
          title: 'Audiencias sincronizadas',
          description: `${data?.synced ?? 0} audiencia(s) atualizada(s).`,
        });
      },
      onError: (err: Error) => toast({ title: 'Falha no sync', description: err.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Audiências</h1>
            <p className="text-xs text-muted-foreground">
              Custom Audiences (lista de clientes) + Lookalikes. PII é hashada no seu navegador.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={sync.isPending} className="gap-2">
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova audiência
          </Button>
        </div>
      </div>

      {isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando audiências…</Card>}
      {error && (
        <Card className="p-6 flex items-center gap-3 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm">Erro: {(error as Error).message}</span>
        </Card>
      )}
      {!isLoading && !error && audiences.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhuma audiência ainda. Clique em "Sincronizar" se já existem audiências no Meta, ou em "Nova audiência" pra criar.
        </Card>
      )}

      <div className="space-y-2">
        {(audiences as MetaAudience[]).map((a) => (
          <AudienceListRow
            key={a.id}
            audience={a}
            onCreateLookalike={() => setCreateOpen(true)}
            onEdit={() => openEdit(a)}
            onDelete={() => setDeleteTarget(a)}
          />
        ))}
      </div>

      <CreateAudienceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteAudienceConfirm audience={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar audiência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label className="text-xs">Retenção (dias)</Label>
              <Input
                type="number" min={1} max={540}
                value={editRetention}
                onChange={(e) => setEditRetention(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={submitEdit} disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudiencesView;
