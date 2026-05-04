// Painel consolidado: Resumo (Dashboard) + Analise + Orcamento Smart em tabs.

import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardView from './DashboardView';
import AnalysisView from './AnalysisView';
import BudgetSmartView from './budget/BudgetSmartView';
import { clearTabPref, readTabPref } from '@/lib/view-navigation';

type Tab = 'resumo' | 'análise' | 'orçamento';

export default function PainelView() {
  const [tab, setTab] = useState<Tab>(() => {
    const pref = readTabPref('painel');
    if (pref === 'análise' || pref === 'orçamento') return pref;
    return 'resumo';
  });
  useEffect(() => { clearTabPref('painel'); }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-6 pt-4 sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="análise">Análise</TabsTrigger>
            <TabsTrigger value="orçamento">Orçamento</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-0">
        {tab === 'resumo' && <DashboardView />}
        {tab === 'análise' && <AnalysisView />}
        {tab === 'orçamento' && <BudgetSmartView />}
      </div>
    </div>
  );
}
