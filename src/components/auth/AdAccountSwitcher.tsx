// agency-mode (Sprint 8/8) — dropdown no header pra trocar ad_account ativa.
import { Building2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAdAccounts, useSetPreferredAdAccount } from '@/hooks/use-ad-accounts';
import { useToast } from '@/hooks/use-toast';

export function AdAccountSwitcher() {
  const { data, isLoading } = useAdAccounts();
  const setPref = useSetPreferredAdAccount();
  const { toast } = useToast();

  const accounts = data?.accounts ?? [];
  const preferred = data?.preferred ?? (accounts[0]?.account_id ?? null);
  const current = accounts.find((a) => a.account_id === preferred) ?? accounts[0];

  if (isLoading || accounts.length === 0) return null;
  // se so 1 conta nao mostra dropdown
  if (accounts.length === 1) return null;

  const switchTo = (externalId: string) => {
    setPref.mutate(externalId, {
      onSuccess: () => toast({ title: 'Conta ativa alterada' }),
      onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          {setPref.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
          {current?.account_name ?? current?.account_id ?? '—'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Trocar ad_account ativa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((a) => (
          <DropdownMenuItem
            key={a.account_id}
            onClick={() => switchTo(a.account_id)}
            className="flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">{a.account_name ?? a.account_id}</div>
              <div className="text-[10px] text-muted-foreground">{a.account_id}</div>
            </div>
            {a.account_id === preferred && <Check className="h-4 w-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
