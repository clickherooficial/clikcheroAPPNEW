import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { useFuryEvaluate } from '@/hooks/use-fury';
import { FuryDashboard } from './FuryDashboard';
import { FuryActionFeed } from './FuryActionFeed';
import { FuryRulesConfig } from './FuryRulesConfig';
import { BehaviorRulesTab } from './BehaviorRulesTab';
import { CreativePipelineTab } from './CreativePipelineTab';

export default function FuryView() {
  const { evaluate, isEvaluating } = useFuryEvaluate();
  const [tab, setTab] = useState('feed');

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 xl:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">FURY v0 — Motor de Performance</h1>
              <p className="text-sm text-muted-foreground">Regras deterministicas + histórico 7 dias</p>
            </div>
          </div>
          <Button onClick={evaluate} disabled={isEvaluating} className="bg-amber-600 hover:bg-amber-700">
            {isEvaluating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            {isEvaluating ? 'Avaliando...' : 'Avaliar Agora'}
          </Button>
        </div>

        {/* Dashboard KPIs */}
        <FuryDashboard />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="feed">Feed de Ações</TabsTrigger>
            <TabsTrigger value="config">Ações automaticas</TabsTrigger>
            <TabsTrigger value="behavior">Comportamento</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline criativo</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-4">
            <FuryActionFeed />
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <FuryRulesConfig />
          </TabsContent>

          <TabsContent value="behavior" className="mt-4">
            <BehaviorRulesTab />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <CreativePipelineTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
