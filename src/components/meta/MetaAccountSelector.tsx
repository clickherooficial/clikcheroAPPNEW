import { useState, useEffect } from 'react';
import { useMetaAssets, type EnrichedAccount, type EnrichedPage } from '@/hooks/use-meta-assets';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Megaphone, FileText } from 'lucide-react';

interface MetaAccountSelectorProps {
  onComplete: () => void;
}

const accountStatusLabels: Record<string, { label: string; color: string }> = {
  '1': { label: 'Ativo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  '2': { label: 'Desativado', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  '3': { label: 'Não aprovado', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  '100': { label: 'Pendente', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
};

export function MetaAccountSelector({ onComplete }: MetaAccountSelectorProps) {
  const { assets, isLoading, error, saveAssets, isSaving } = useMetaAssets(true);

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  // Pre-select already saved accounts
  useEffect(() => {
    if (assets) {
      setSelectedAccounts(new Set(assets.selected_account_ids));
      setSelectedPages(new Set(assets.selected_page_ids));
    }
  }, [assets]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = (id: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!assets) return;

    const allAdAccounts = [
      ...assets.personal_ad_accounts,
      ...assets.businesses.flatMap((b) => b.ad_accounts),
    ];
    const allPages = [
      ...assets.personal_pages,
      ...assets.businesses.flatMap((b) => b.pages),
    ];

    const adAccounts = allAdAccounts
      .filter((a) => selectedAccounts.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        account_status: a.account_status ?? 0,
        currency: a.currency,
        business_id: a.business_id,
        business_name: undefined,
      }));

    const pages = allPages
      .filter((p) => selectedPages.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category ?? '',
        access_token: '',
      }));

    saveAssets(
      { ad_accounts: adAccounts, pages },
      { onSuccess: () => onComplete() }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-white/40">Carregando ativos da conta Meta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 text-center">
        <p className="text-sm text-red-300">Erro ao carregar ativos: {(error as Error).message}</p>
      </div>
    );
  }

  if (!assets) return null;

  const ad_accounts = [
    ...assets.personal_ad_accounts,
    ...assets.businesses.flatMap((b) => b.ad_accounts),
  ];
  const { businesses } = assets;
  const pages = [
    ...assets.personal_pages,
    ...assets.businesses.flatMap((b) => b.pages),
  ];

  return (
    <div className="space-y-6">
      {/* Ad Accounts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-white/80">
            Contas de Anúncio ({ad_accounts.length})
          </h3>
        </div>

        {ad_accounts.length === 0 ? (
          <p className="text-xs text-white/30 pl-6">Nenhuma conta de anúncio encontrada.</p>
        ) : (
          <div className="space-y-1.5">
            {ad_accounts.map((account: EnrichedAccount) => {
              const status = accountStatusLabels[String(account.account_status)] ?? {
                label: account.account_status,
                color: 'text-white/40 bg-white/5 border-white/10',
              };

              return (
                <label
                  key={account.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedAccounts.has(account.id)}
                    onCheckedChange={() => toggleAccount(account.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{account.name}</p>
                    <p className="text-xs text-white/30 truncate">
                      {account.id} {account.currency && `· ${account.currency}`}
                    </p>
                  </div>
                  <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* Business Managers */}
      {businesses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-white/80">
              Business Managers ({businesses.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {businesses.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <Building2 className="w-4 h-4 text-white/20" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{bm.name}</p>
                  <p className="text-xs text-white/30">{bm.id}</p>
                </div>
                <Badge className="text-xs text-blue-400 bg-blue-500/10 border-blue-500/20">
                  Vinculado
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pages */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-white/80">
            Páginas do Facebook ({pages.length})
          </h3>
        </div>

        {pages.length === 0 ? (
          <p className="text-xs text-white/30 pl-6">Nenhuma página encontrada.</p>
        ) : (
          <div className="space-y-1.5">
            {pages.map((page: EnrichedPage) => (
              <label
                key={page.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedPages.has(page.id)}
                  onCheckedChange={() => togglePage(page.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{page.name}</p>
                  <p className="text-xs text-white/30">{page.category ?? page.id}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={isSaving || selectedAccounts.size === 0}
        className="w-full h-11 brand-gradient text-white font-medium rounded-xl hover:opacity-90 transition-all"
      >
        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar Seleção ({selectedAccounts.size} conta{selectedAccounts.size !== 1 ? 's' : ''}, {selectedPages.size} página{selectedPages.size !== 1 ? 's' : ''})
      </Button>
    </div>
  );
}
