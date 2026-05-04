// audience-management (Sprint 3/8) — alert dialog de confirmacao.
// Mostra adsets que usam a audiencia (incluido/excluido). Bloqueia se algum esta ATIVO.
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAudienceUsage, useDeleteAudience } from '@/hooks/use-audiences';
import { useToast } from '@/hooks/use-toast';
import type { MetaAudience } from '@/types/audiences';

interface Props {
  audience: MetaAudience | null;
  onClose: () => void;
}

export function DeleteAudienceConfirm({ audience, onClose }: Props) {
  const { data: usage = [] } = useAudienceUsage(audience?.id ?? null);
  const del = useDeleteAudience();
  const { toast } = useToast();

  const activeUsage = (usage as { adset_status: string }[]).filter((u) => u.adset_status === 'ACTIVE');
  const blocked = activeUsage.length > 0;

  const submit = () => {
    if (!audience) return;
    del.mutate(
      { audience_id: audience.id, confirm: true },
      {
        onSuccess: (data: any) => {
          toast({
            title: data?.sandbox ? 'Delete simulado (sandbox)' : 'Audiencia deletada',
          });
          onClose();
        },
        onError: (err: Error) => {
          toast({ title: 'Falha ao deletar', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <AlertDialog open={!!audience} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Deletar "{audience?.name}"?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Esta acao e irreversivel. A audiencia sera removida do Meta Ads.</p>
            {blocked ? (
              <div className="border border-destructive/40 rounded p-2 bg-destructive/5 mt-2">
                <strong className="text-destructive text-sm">Bloqueado — em uso por {activeUsage.length} adset(s) ativo(s):</strong>
                <ul className="text-xs mt-1 list-disc list-inside">
                  {activeUsage.slice(0, 5).map((u: any) => (
                    <li key={u.adset_id}>{u.adset_name} ({u.usage_kind})</li>
                  ))}
                </ul>
                <p className="text-xs mt-1 text-muted-foreground">Pause ou desanexe o adset primeiro.</p>
              </div>
            ) : usage.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Em uso por {usage.length} adset(s) inativo(s) — delete e seguro.
              </p>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={submit}
            disabled={blocked || del.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Deletar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
