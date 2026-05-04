import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useComplianceRules } from '@/hooks/use-compliance';
import { Plus, Trash2, Shield, Loader2 } from 'lucide-react';

const SEVERITY_BADGES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

type RuleType = 'blacklist_term' | 'required_term';

function RuleList({ rules, source, canDelete, onRemove, isRemoving }: {
  rules: Array<{ id: string; value: string; severity: string; source: string }>;
  source: 'user' | 'meta_default';
  canDelete: boolean;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}) {
  const filtered = rules.filter((r) => r.source === source);
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {source === 'user' ? 'Seus termos' : 'Padrao Meta (não editavel)'}
      </h5>
      <div className="flex flex-wrap gap-2">
        {filtered.map((rule) => (
          <Badge key={rule.id} variant="outline" className={`${SEVERITY_BADGES[rule.severity] ?? ''} border gap-1 ${!canDelete ? 'opacity-70' : 'pr-1'}`}>
            {rule.value}
            {canDelete && (
              <button onClick={() => onRemove(rule.id)} disabled={isRemoving} className="ml-1 hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function BlacklistManager() {
  const { rules, isLoading, addRule, removeRule } = useComplianceRules();
  const [newTerm, setNewTerm] = useState('');
  const [newSeverity, setNewSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [activeTab, setActiveTab] = useState<RuleType>('blacklist_term');

  const handleAdd = () => {
    if (!newTerm.trim()) return;
    addRule.mutate({ value: newTerm, severity: newSeverity, ruleType: activeTab });
    setNewTerm('');
  };

  const blacklist = rules.filter((r) => r.rule_type === 'blacklist_term');
  const required = rules.filter((r) => r.rule_type === 'required_term');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Regras de Compliance
        </CardTitle>
        <CardDescription>
          Termos proibidos e obrigatorios nos anúncios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RuleType)}>
          <TabsList>
            <TabsTrigger value="blacklist_term">Proibidos ({blacklist.length})</TabsTrigger>
            <TabsTrigger value="required_term">Obrigatorios ({required.length})</TabsTrigger>
          </TabsList>

          {/* Add new term */}
          <div className="flex gap-2 mt-4">
            <Input
              placeholder={activeTab === 'blacklist_term' ? 'Novo termo proibido...' : 'Novo termo obrigatorio...'}
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as typeof newSeverity)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Alerta</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!newTerm.trim() || addRule.isPending}>
              {addRule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="blacklist_term" className="space-y-3 mt-3">
                <RuleList rules={blacklist} source="user" canDelete onRemove={(id) => removeRule.mutate(id)} isRemoving={removeRule.isPending} />
                <RuleList rules={blacklist} source="meta_default" canDelete={false} onRemove={() => {}} isRemoving={false} />
                {blacklist.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum termo proibido cadastrado.</p>}
              </TabsContent>

              <TabsContent value="required_term" className="space-y-3 mt-3">
                <RuleList rules={required} source="user" canDelete onRemove={(id) => removeRule.mutate(id)} isRemoving={removeRule.isPending} />
                {required.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum termo obrigatorio cadastrado. Ex: "parceiro oficial", "registro CNPJ"</p>}
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
