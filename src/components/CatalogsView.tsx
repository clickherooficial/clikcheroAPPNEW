// catalog-management (Sprint 6/8) — View "Catalogos" (read-only MVP).
import { Package, RefreshCw, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCatalogs, useSyncCatalogs } from '@/hooks/use-catalogs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ProductCatalog, ProductSet } from '@/types/catalogs';

const CatalogsView = () => {
  const { data, isLoading, error } = useCatalogs();
  const sync = useSyncCatalogs();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const catalogs = data?.catalogs ?? [];
  const sets = data?.sets ?? [];

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: (d: any) => {
        toast({
          title: 'Catalogos sincronizados',
          description: `${d?.synced_catalogs ?? 0} catalog(s), ${d?.synced_sets ?? 0} set(s).`,
        });
      },
      onError: (err: Error) => toast({ title: 'Falha no sync', description: err.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Catálogos</h1>
            <p className="text-xs text-muted-foreground">
              Product Catalogs do Meta Business — base para campanhas DPA. Read-only no MVP.
            </p>
          </div>
        </div>
        <Button onClick={handleSync} disabled={sync.isPending} className="gap-2">
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar
        </Button>
      </div>

      {isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}
      {error && (
        <Card className="p-6 flex items-center gap-3 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm">{(error as Error).message}</span>
        </Card>
      )}
      {!isLoading && !error && catalogs.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum catalog encontrado. Clique "Sincronizar" pra puxar do Meta Business (precisa estar conectado).
        </Card>
      )}

      <div className="space-y-2">
        {(catalogs as ProductCatalog[]).map((c) => {
          const expanded = expandedId === c.id;
          const cSets = (sets as ProductSet[]).filter((s) => s.catalog_id === c.id);
          return (
            <div key={c.id} className="space-y-2">
              <button
                onClick={() => setExpandedId(expanded ? null : c.id)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition',
                  expanded && 'border-primary/40 bg-accent/20',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition', expanded && 'rotate-90')} />
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{c.product_count ?? '?'} produtos</span>
                      {c.vertical && (<><span>·</span><Badge variant="outline" className="text-[10px]">{c.vertical}</Badge></>)}
                      <span>·</span>
                      <span>{cSets.length} set(s)</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">id: {c.external_id}</span>
              </button>
              {expanded && cSets.length > 0 && (
                <div className="ml-7 pl-4 border-l space-y-1">
                  {cSets.map((s) => (
                    <div key={s.id} className="text-sm py-1.5 flex items-center justify-between">
                      <span className="truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.product_count ?? '?'} produtos · id={s.external_id}</span>
                    </div>
                  ))}
                </div>
              )}
              {expanded && cSets.length === 0 && (
                <div className="ml-7 text-xs text-muted-foreground italic">Nenhum product_set neste catalog.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogsView;
