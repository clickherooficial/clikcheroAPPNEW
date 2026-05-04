import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ScanSearch } from 'lucide-react';
import { useComplianceScan } from '@/hooks/use-compliance';
import { ComplianceDashboard } from './ComplianceDashboard';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceSettings } from './ComplianceSettings';
import { TakedownHistory } from './TakedownHistory';

export default function ComplianceView() {
  const { scan, isScanning } = useComplianceScan();
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 xl:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Smart Takedown + Compliance</h1>
              <p className="text-sm text-muted-foreground">Análise de conformidade dos anúncios via IA</p>
            </div>
          </div>
          <Button onClick={scan} disabled={isScanning}>
            {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-2" />}
            {isScanning ? 'Analisando...' : 'Analisar Agora'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="anúncios">Anúncios</TabsTrigger>
            <TabsTrigger value="configurações">Configurações</TabsTrigger>
            <TabsTrigger value="histórico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <ComplianceDashboard />
          </TabsContent>

          <TabsContent value="anúncios" className="mt-4">
            <ComplianceTable />
          </TabsContent>

          <TabsContent value="configurações" className="mt-4">
            <ComplianceSettings />
          </TabsContent>

          <TabsContent value="histórico" className="mt-4">
            <TakedownHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
