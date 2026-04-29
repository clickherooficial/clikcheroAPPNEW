// Cerebro do FURY: tudo que o agente "sabe e faz" sobre seu negocio.
// 4 abas: Regras (todas) + Memoria (KB) + Identidade (briefing) + Historico (timeline)
//
// Consolida 3 entries da sidebar (FURY + Memoria + briefing externo) pra 1.

import { useEffect, useState } from 'react';
import { clearTabPref, readTabPref } from '@/lib/view-navigation';
import { Brain, Loader2, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFuryEvaluate } from '@/hooks/use-fury';
import { FuryDashboard } from './fury/FuryDashboard';
import { FuryActionFeed } from './fury/FuryActionFeed';
import { FuryRulesConfig } from './fury/FuryRulesConfig';
import { BehaviorRulesTab } from './fury/BehaviorRulesTab';
import { CreativePipelineTab } from './fury/CreativePipelineTab';
import { useActiveRules } from '@/hooks/useActiveRules';
import MemoryView from './knowledge/MemoryView';
import { BriefingView } from './briefing/BriefingView';

type Tab = 'regras' | 'memoria' | 'identidade' | 'historico';
type RuleSubTab = 'todas' | 'comportamento' | 'acoes' | 'pipeline';

export default function CerebroFuryView() {
  const [tab, setTab] = useState<Tab>(() => {
    const pref = readTabPref('cerebro');
    if (pref === 'memoria' || pref === 'identidade' || pref === 'historico') return pref;
    return 'regras';
  });
  const [ruleSubTab, setRuleSubTab] = useState<RuleSubTab>(() => {
    const pref = readTabPref('cerebro-rules');
    if (pref === 'comportamento' || pref === 'acoes' || pref === 'pipeline') return pref;
    return 'todas';
  });
  useEffect(() => {
    clearTabPref('cerebro');
    clearTabPref('cerebro-rules');
  }, []);
  const { evaluate, isEvaluating } = useFuryEvaluate();
  const { behavior, pipeline, action } = useActiveRules();
  const totalRules = behavior.length + pipeline.length + action.length;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 xl:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Brain className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Configuracoes</h1>
              <p className="text-sm text-muted-foreground">Tudo que o assistente sabe e faz sobre seu negocio.</p>
            </div>
          </div>
          {tab === 'regras' && (
            <Button onClick={evaluate} disabled={isEvaluating} className="bg-amber-600 hover:bg-amber-700">
              {isEvaluating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              {isEvaluating ? 'Avaliando...' : 'Avaliar agora'}
            </Button>
          )}
        </div>

        {/* Tabs principais */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="regras">
              Regras
              {totalRules > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">{totalRules}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="memoria">Memoria</TabsTrigger>
            <TabsTrigger value="identidade">Identidade</TabsTrigger>
            <TabsTrigger value="historico">Historico</TabsTrigger>
          </TabsList>

          {/* === Regras === */}
          <TabsContent value="regras" className="mt-4 space-y-4">
            <FuryDashboard />
            <Tabs value={ruleSubTab} onValueChange={(v) => setRuleSubTab(v as RuleSubTab)}>
              <TabsList>
                <TabsTrigger value="todas">Todas ({totalRules})</TabsTrigger>
                <TabsTrigger value="comportamento">Comportamento ({behavior.length})</TabsTrigger>
                <TabsTrigger value="acoes">Acoes automaticas ({action.length})</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline criativo ({pipeline.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="todas" className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Regras aprendidas pelo FURY no chat ou configuradas manualmente. Cada uma diz o que ele deve sempre/nunca fazer.
                </p>
                <BehaviorRulesTab />
                <CreativePipelineTab />
                <FuryRulesConfig />
              </TabsContent>
              <TabsContent value="comportamento" className="mt-4">
                <BehaviorRulesTab />
              </TabsContent>
              <TabsContent value="acoes" className="mt-4">
                <FuryRulesConfig />
              </TabsContent>
              <TabsContent value="pipeline" className="mt-4">
                <CreativePipelineTab />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* === Memoria === */}
          <TabsContent value="memoria" className="mt-4">
            <MemoryView />
          </TabsContent>

          {/* === Identidade === */}
          <TabsContent value="identidade" className="mt-4">
            <BriefingView />
          </TabsContent>

          {/* === Historico === */}
          <TabsContent value="historico" className="mt-4">
            <FuryActionFeed />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
