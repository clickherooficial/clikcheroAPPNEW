import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Rocket, History, Plus } from 'lucide-react';
import { PublishWizard } from './PublishWizard';
import { PublicationHistory } from './PublicationHistory';

export default function CampaignPublisherView() {
  const [tab, setTab] = useState('new');

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-6 xl:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rocket className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Publicar Campanha</h1>
              <p className="text-sm text-muted-foreground">Criação 3 niveis com compliance gate nativo</p>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="new" className="gap-2"><Plus className="w-3 h-3" /> Nova</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="w-3 h-3" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <PublishWizard onPublished={() => setTab('history')} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <PublicationHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
