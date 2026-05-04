import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Filter } from 'lucide-react';

export type Period = 'today' | '7d' | '30d';

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  accounts: Array<{ account_id: string; account_name: string | null }>;
  selectedAccounts: string[];
  onSelectedAccountsChange: (ids: string[]) => void;
  campaigns: string[];
  selectedCampaigns: string[];
  onSelectedCampaignsChange: (names: string[]) => void;
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

function toggle(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((a) => a !== item) : [...arr, item];
}

export function DashFilters({
  period, onPeriodChange,
  accounts, selectedAccounts, onSelectedAccountsChange,
  campaigns, selectedCampaigns, onSelectedCampaignsChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period chips */}
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPeriodChange(p.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              period === p.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {accounts.length > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              {selectedAccounts.length === 0 ? 'Todas as contas' : `${selectedAccounts.length} conta(s)`}
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-2">
            <div className="space-y-1 max-h-[280px] overflow-auto">
              {accounts.map((a) => (
                <label key={a.account_id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedAccounts.includes(a.account_id)}
                    onCheckedChange={() => onSelectedAccountsChange(toggle(selectedAccounts, a.account_id))}
                  />
                  <span className="text-sm truncate">{a.account_name ?? a.account_id}</span>
                </label>
              ))}
            </div>
            {selectedAccounts.length > 0 && (
              <button onClick={() => onSelectedAccountsChange([])} className="text-xs text-muted-foreground hover:text-foreground w-full text-left px-2 py-1 mt-1 border-t pt-2">
                Limpar seleção
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}

      {campaigns.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              {selectedCampaigns.length === 0 ? 'Todas campanhas' : `${selectedCampaigns.length} campanha(s)`}
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2">
            <div className="space-y-1 max-h-[320px] overflow-auto">
              {campaigns.map((name) => (
                <label key={name} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedCampaigns.includes(name)}
                    onCheckedChange={() => onSelectedCampaignsChange(toggle(selectedCampaigns, name))}
                  />
                  <span className="text-sm truncate">{name}</span>
                </label>
              ))}
            </div>
            {selectedCampaigns.length > 0 && (
              <button onClick={() => onSelectedCampaignsChange([])} className="text-xs text-muted-foreground hover:text-foreground w-full text-left px-2 py-1 mt-1 border-t pt-2">
                Limpar seleção
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
