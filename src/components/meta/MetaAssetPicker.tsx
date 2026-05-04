import { useState, useEffect, useMemo } from 'react';
import { useMetaAssets, type BusinessNode, type EnrichedAccount, type EnrichedPage, type SaveAssetsPayload } from '@/hooks/use-meta-assets';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Loader2, Building2, Megaphone, FileText, Search, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Flame, User,
} from 'lucide-react';
import { fmtBRL } from '@/lib/meta-labels';

// Meta account_status codes:
// 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW, 8=PENDING_SETTLEMENT,
// 9=IN_GRACE_PERIOD, 100=PENDING_CLOSURE, 101=CLOSED, 201=ANY_ACTIVE, 202=ANY_CLOSED
const ACCOUNT_STATUS: Record<number, { label: string; tone: 'ok' | 'bad' | 'warn' }> = {
  1: { label: 'Ativo', tone: 'ok' },
  2: { label: 'Desativado', tone: 'bad' },
  3: { label: 'Pendente pagto', tone: 'warn' },
  7: { label: 'Em revisão', tone: 'warn' },
  8: { label: 'Pendente pagto', tone: 'warn' },
  9: { label: 'Período graca', tone: 'warn' },
  100: { label: 'Pendente fechamento', tone: 'bad' },
  101: { label: 'Fechado', tone: 'bad' },
};

const TONE_STYLES: Record<'ok' | 'bad' | 'warn', string> = {
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  bad: 'bg-red-500/10 text-red-400 border-red-500/20',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

interface Props {
  onComplete: () => void;
  onCancel?: () => void;
}

export function MetaAssetPicker({ onComplete, onCancel }: Props) {
  const { assets, isLoading, error, saveAssetsAsync, isSaving } = useMetaAssets(true);

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [expandedBMs, setExpandedBMs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  // Pre-marcar o que ja foi selecionado
  useEffect(() => {
    if (assets) {
      setSelectedAccounts(new Set(assets.selected_account_ids));
      setSelectedPages(new Set(assets.selected_page_ids));
      // Expandir BMs que tem algo selecionado
      const bmsWithSelection = new Set<string>();
      for (const bn of assets.businesses) {
        const hasAcc = bn.ad_accounts.some((a) => assets.selected_account_ids.includes(a.account_id ?? a.id.replace(/^act_/, '')));
        const hasPg = bn.pages.some((p) => assets.selected_page_ids.includes(p.id));
        if (hasAcc || hasPg) bmsWithSelection.add(bn.id);
      }
      // Se nenhum, expande o primeiro por padrao
      if (bmsWithSelection.size === 0 && assets.businesses.length > 0) {
        bmsWithSelection.add(assets.businesses[0].id);
      }
      setExpandedBMs(bmsWithSelection);
    }
  }, [assets]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePage = (id: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBM = (id: string) => {
    setExpandedBMs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Select/deselect all accounts/pages de um BM
  const selectAllFromBM = (bm: BusinessNode, value: boolean) => {
    const accIds = bm.ad_accounts.map((a) => a.account_id ?? a.id.replace(/^act_/, ''));
    const pgIds = bm.pages.map((p) => p.id);
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      for (const id of accIds) {
        if (value) next.add(id); else next.delete(id);
      }
      return next;
    });
    setSelectedPages((prev) => {
      const next = new Set(prev);
      for (const id of pgIds) {
        if (value) next.add(id); else next.delete(id);
      }
      return next;
    });
  };

  // Filtrar pelo search + onlyActive
  const filteredAssets = useMemo(() => {
    if (!assets) return null;
    const s = search.toLowerCase().trim();

    const filterAcc = (a: EnrichedAccount) => {
      if (onlyActive && a.active_campaigns_count === 0) return false;
      if (!s) return true;
      return a.name.toLowerCase().includes(s) || (a.account_id ?? '').includes(s);
    };
    const filterPg = (p: EnrichedPage) => {
      if (!s) return true;
      return p.name.toLowerCase().includes(s);
    };

    const businesses = assets.businesses
      .map((bn) => ({
        ...bn,
        ad_accounts: bn.ad_accounts.filter(filterAcc),
        pages: bn.pages.filter(filterPg),
      }))
      .filter((bn) => {
        if (!s) return true;
        // Mantem BM se nome bate ou tem accounts/pages que batem
        return bn.name.toLowerCase().includes(s) || bn.ad_accounts.length > 0 || bn.pages.length > 0;
      });

    return {
      businesses,
      personal_ad_accounts: assets.personal_ad_accounts.filter(filterAcc),
      personal_pages: assets.personal_pages.filter(filterPg),
    };
  }, [assets, search, onlyActive]);

  const totalSelectedAccounts = selectedAccounts.size;
  const totalSelectedPages = selectedPages.size;
  const canSave = totalSelectedAccounts > 0 && totalSelectedPages > 0;

  const handleSave = async () => {
    if (!assets || !canSave) return;

    // Encontrar os objetos completos dos IDs selecionados (pra enviar business_id, name, etc.)
    const allAccounts: EnrichedAccount[] = [
      ...assets.businesses.flatMap((b) => b.ad_accounts),
      ...assets.personal_ad_accounts,
    ];
    const allPages: EnrichedPage[] = [
      ...assets.businesses.flatMap((b) => b.pages),
      ...assets.personal_pages,
    ];
    const bmMap = new Map(assets.businesses.map((b) => [b.id, b.name]));

    const selectedAccountObjs = allAccounts
      .filter((a) => selectedAccounts.has(a.account_id ?? a.id.replace(/^act_/, '')))
      .map((a) => ({
        id: a.account_id ?? a.id.replace(/^act_/, ''),
        name: a.name,
        account_status: a.account_status,
        currency: a.currency,
        business_id: a.business_id,
        business_name: a.business_id ? bmMap.get(a.business_id) ?? null : null,
      }));

    const selectedPageObjs = allPages
      .filter((p) => selectedPages.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        business_id: p.business_id,
        business_name: p.business_id ? bmMap.get(p.business_id) ?? null : null,
      }));

    const payload: SaveAssetsPayload = {
      ad_accounts: selectedAccountObjs,
      pages: selectedPageObjs,
    };

    try {
      await saveAssetsAsync(payload);
      onComplete();
    } catch { /* toast ja mostrado */ }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando ativos Meta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-muted-foreground">Erro ao carregar ativos:<br />{(error as Error).message}</p>
      </div>
    );
  }

  if (!assets || !filteredAssets) return null;

  const noAssets = filteredAssets.businesses.length === 0 && filteredAssets.personal_ad_accounts.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header com busca + filtro */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border/50">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar BM, conta ou página..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          Apenas com campanhas ativas
        </label>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
        {noAssets ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum ativo encontrado{search ? ` para "${search}"` : ''}.
          </div>
        ) : (
          <>
            {filteredAssets.businesses.map((bm) => (
              <BMCard
                key={bm.id}
                bm={bm}
                expanded={expandedBMs.has(bm.id)}
                onToggleExpand={() => toggleBM(bm.id)}
                selectedAccounts={selectedAccounts}
                selectedPages={selectedPages}
                onToggleAccount={toggleAccount}
                onTogglePage={togglePage}
                onSelectAll={(value) => selectAllFromBM(bm, value)}
              />
            ))}

            {filteredAssets.personal_ad_accounts.length > 0 || filteredAssets.personal_pages.length > 0 ? (
              <PersonalSection
                accounts={filteredAssets.personal_ad_accounts}
                pages={filteredAssets.personal_pages}
                selectedAccounts={selectedAccounts}
                selectedPages={selectedPages}
                onToggleAccount={toggleAccount}
                onTogglePage={togglePage}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Footer com contadores + save */}
      <div className="pt-4 border-t border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-xs">
            <Badge variant="outline" className="gap-1">
              <Megaphone className="w-3 h-3" /> {totalSelectedAccounts} conta{totalSelectedAccounts !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="w-3 h-3" /> {totalSelectedPages} página{totalSelectedPages !== 1 ? 's' : ''}
            </Badge>
            {!canSave && (
              <span className="text-amber-400 text-xs">
                {totalSelectedAccounts === 0 ? 'Selecione ao menos 1 conta' : 'Selecione ao menos 1 página'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
                Cancelar
              </Button>
            )}
            <Button onClick={handleSave} disabled={!canSave || isSaving} size="sm">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salvar Seleção
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BM Card
// ============================================================

function BMCard({
  bm, expanded, onToggleExpand,
  selectedAccounts, selectedPages,
  onToggleAccount, onTogglePage, onSelectAll,
}: {
  bm: BusinessNode;
  expanded: boolean;
  onToggleExpand: () => void;
  selectedAccounts: Set<string>;
  selectedPages: Set<string>;
  onToggleAccount: (id: string) => void;
  onTogglePage: (id: string) => void;
  onSelectAll: (value: boolean) => void;
}) {
  const accIds = bm.ad_accounts.map((a) => a.account_id ?? a.id.replace(/^act_/, ''));
  const pgIds = bm.pages.map((p) => p.id);

  const allSelected = accIds.length > 0 && accIds.every((id) => selectedAccounts.has(id))
    && pgIds.every((id) => selectedPages.has(id));
  const someSelected = accIds.some((id) => selectedAccounts.has(id)) || pgIds.some((id) => selectedPages.has(id));

  const activeCount = bm.ad_accounts.filter((a) => a.active_campaigns_count > 0).length;

  return (
    <div className="border border-border/50 rounded-xl bg-card/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{bm.name}</div>
            <div className="text-xs text-muted-foreground">
              {bm.ad_accounts.length} conta{bm.ad_accounts.length !== 1 ? 's' : ''}
              {activeCount > 0 && ` · ${activeCount} com campanhas ativas`}
              {bm.pages.length > 0 && ` · ${bm.pages.length} página${bm.pages.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </button>
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={(v) => onSelectAll(v === true)}
        />
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border/50 p-3 space-y-4 bg-background/30">
          {/* Ad accounts */}
          {bm.ad_accounts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Contas de Anúncio
              </div>
              {bm.ad_accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  selected={selectedAccounts.has(a.account_id ?? a.id.replace(/^act_/, ''))}
                  onToggle={() => onToggleAccount(a.account_id ?? a.id.replace(/^act_/, ''))}
                />
              ))}
            </div>
          )}
          {/* Pages */}
          {bm.pages.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Páginas do Facebook
              </div>
              {bm.pages.map((p) => (
                <PageRow
                  key={p.id}
                  page={p}
                  selected={selectedPages.has(p.id)}
                  onToggle={() => onTogglePage(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Personal section (sem BM)
// ============================================================

function PersonalSection({
  accounts, pages, selectedAccounts, selectedPages, onToggleAccount, onTogglePage,
}: {
  accounts: EnrichedAccount[];
  pages: EnrichedPage[];
  selectedAccounts: Set<string>;
  selectedPages: Set<string>;
  onToggleAccount: (id: string) => void;
  onTogglePage: (id: string) => void;
}) {
  return (
    <div className="border border-border/50 rounded-xl bg-card/30 p-3 space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground" />
        <div className="font-medium text-sm">Contas Pessoais (sem Business Manager)</div>
      </div>
      {accounts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Contas de Anúncio
          </div>
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              selected={selectedAccounts.has(a.account_id ?? a.id.replace(/^act_/, ''))}
              onToggle={() => onToggleAccount(a.account_id ?? a.id.replace(/^act_/, ''))}
            />
          ))}
        </div>
      )}
      {pages.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Páginas
          </div>
          {pages.map((p) => (
            <PageRow key={p.id} page={p} selected={selectedPages.has(p.id)} onToggle={() => onTogglePage(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Rows
// ============================================================

function AccountRow({ account, selected, onToggle }: { account: EnrichedAccount; selected: boolean; onToggle: () => void }) {
  const status = account.account_status != null ? ACCOUNT_STATUS[account.account_status] : null;
  const hasActive = account.active_campaigns_count > 0;

  return (
    <label className={cn(
      'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
      selected ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:bg-muted/40',
    )}>
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{account.name}</div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {account.currency && <Badge variant="outline" className="text-[10px] h-5 px-1.5">{account.currency}</Badge>}
          {status && <Badge className={cn('text-[10px] h-5 px-1.5 border', TONE_STYLES[status.tone])}>{status.label}</Badge>}
          {hasActive && (
            <Badge className="text-[10px] h-5 px-1.5 bg-orange-500/10 text-orange-400 border-orange-500/20 border gap-1">
              <Flame className="w-2.5 h-2.5" />
              {account.active_campaigns_count} ativa{account.active_campaigns_count !== 1 ? 's' : ''}
            </Badge>
          )}
          {account.spend_last_30d > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {fmtBRL(account.spend_last_30d)} nos últimos 30d
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function PageRow({ page, selected, onToggle }: { page: EnrichedPage; selected: boolean; onToggle: () => void }) {
  return (
    <label className={cn(
      'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
      selected ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:bg-muted/40',
    )}>
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      {page.picture?.data?.url ? (
        <img src={page.picture.data.url} alt="" className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{page.name}</div>
        {page.category && <div className="text-xs text-muted-foreground">{page.category}</div>}
      </div>
    </label>
  );
}
