// audience-management (Sprint 3/8) — dialog com 3 tabs (Custom / Pixel placeholder / Lookalike).
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCreateCustomerListAudience, useCreateLookalike } from '@/hooks/use-audiences';
import { useCreatePixelAudience, useCreateEngagementAudience } from '@/hooks/use-audience-sources';
import { useToast } from '@/hooks/use-toast';
import { CSVDropzone } from './CSVDropzone';
import { LookalikePicker } from './LookalikePicker';
import { PixelRuleBuilder } from './PixelRuleBuilder';
import { EngagementPicker } from './EngagementPicker';
import type { AudienceCustomerSchema, LookalikeRatio } from '@/types/audiences';
import type { CreateEngagementAudiencePayload, CreatePixelAudiencePayload } from '@/types/pixel-audiences';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function CreateAudienceDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const createCustom = useCreateCustomerListAudience();
  const createLal = useCreateLookalike();
  const createPixel = useCreatePixelAudience();
  const createEng = useCreateEngagementAudience();

  // Custom tab state
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [retention, setRetention] = useState(180);
  const [csvParsed, setCsvParsed] = useState<{ schema: AudienceCustomerSchema[]; rawData: string[][] } | null>(null);

  // Lookalike tab state
  const [lalForm, setLalForm] = useState<{ name: string; originId: string; country: string; ratio: LookalikeRatio } | null>(null);

  // Pixel + Engagement (Sprint 4)
  const [pixelPayload, setPixelPayload] = useState<CreatePixelAudiencePayload | null>(null);
  const [engPayload, setEngPayload] = useState<CreateEngagementAudiencePayload | null>(null);

  const [activeTab, setActiveTab] = useState<'custom' | 'pixel' | 'lookalike' | 'engagement'>('custom');

  const close = () => {
    setCustomName(''); setCustomDesc(''); setRetention(180); setCsvParsed(null); setLalForm(null);
    setPixelPayload(null); setEngPayload(null);
    onOpenChange(false);
  };

  const submitCustom = () => {
    if (!customName || !csvParsed) {
      toast({ title: 'Preencha nome e suba o CSV', variant: 'destructive' });
      return;
    }
    createCustom.mutate(
      {
        name: customName,
        description: customDesc || undefined,
        retention_days: retention,
        schema: csvParsed.schema,
        rawData: csvParsed.rawData,
      },
      {
        onSuccess: (data: any) => {
          toast({
            title: data?.sandbox ? 'Audiencia simulada (sandbox)' : 'Audiencia criada',
            description: `${data?.rows ?? csvParsed.rawData.length} linhas processadas em ${data?.batches ?? '?'} batch(es).`,
          });
          close();
        },
        onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
      },
    );
  };

  const submitPixel = () => {
    if (!pixelPayload) {
      toast({ title: 'Preencha nome e selecione pixel', variant: 'destructive' });
      return;
    }
    createPixel.mutate(pixelPayload, {
      onSuccess: (data: any) => {
        toast({ title: data?.sandbox ? 'Pixel audience simulada (sandbox)' : 'Pixel audience criada' });
        close();
      },
      onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
    });
  };

  const submitEngagement = () => {
    if (!engPayload) {
      toast({ title: 'Preencha nome e fonte', variant: 'destructive' });
      return;
    }
    createEng.mutate(engPayload, {
      onSuccess: (data: any) => {
        toast({ title: data?.sandbox ? 'Engagement audience simulada (sandbox)' : 'Engagement audience criada' });
        close();
      },
      onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
    });
  };

  const submitLookalike = () => {
    if (!lalForm) {
      toast({ title: 'Preencha origem e nome', variant: 'destructive' });
      return;
    }
    createLal.mutate(
      {
        name: lalForm.name,
        origin_audience_id: lalForm.originId,
        lookalike_spec: { country: lalForm.country, ratio: lalForm.ratio, type: 'similarity' },
      },
      {
        onSuccess: (data: any) => {
          toast({ title: data?.sandbox ? 'LAL simulada (sandbox)' : 'Lookalike criada' });
          close();
        },
        onError: (err: Error) => toast({ title: 'Falha', description: err.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => o ? onOpenChange(o) : close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Audiencia</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="custom">Custom (CSV)</TabsTrigger>
            <TabsTrigger value="pixel">Pixel</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="lookalike">Lookalike</TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={80} />
              </div>
              <div>
                <Label className="text-xs">Retencao (dias, max 540)</Label>
                <Input type="number" min={1} max={540} value={retention} onChange={(e) => setRetention(Math.min(540, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descricao (opcional)</Label>
              <Input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} maxLength={255} />
            </div>
            <CSVDropzone onParsed={(p) => setCsvParsed({ schema: p.schema, rawData: p.rawData })} />
            <div className="text-[11px] text-muted-foreground">
              PII (email/telefone) e hashado SHA256 no seu navegador antes de subir. O servidor nunca recebe texto claro.
            </div>
          </TabsContent>

          <TabsContent value="lookalike">
            <LookalikePicker value={lalForm} onChange={setLalForm} />
          </TabsContent>

          <TabsContent value="pixel">
            <PixelRuleBuilder value={pixelPayload} onChange={setPixelPayload} />
          </TabsContent>

          <TabsContent value="engagement">
            <EngagementPicker value={engPayload} onChange={setEngPayload} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          {activeTab === 'custom' && (
            <Button onClick={submitCustom} disabled={createCustom.isPending}>
              {createCustom.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Custom
            </Button>
          )}
          {activeTab === 'pixel' && (
            <Button onClick={submitPixel} disabled={createPixel.isPending || !pixelPayload}>
              {createPixel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Pixel Audience
            </Button>
          )}
          {activeTab === 'engagement' && (
            <Button onClick={submitEngagement} disabled={createEng.isPending || !engPayload}>
              {createEng.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Engagement
            </Button>
          )}
          {activeTab === 'lookalike' && (
            <Button onClick={submitLookalike} disabled={createLal.isPending}>
              {createLal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Lookalike
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
