import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBrandGuide } from '@/hooks/use-compliance';
import { BlacklistManager } from './BlacklistManager';
import { ShieldAlert, Sliders, Palette, Image, Plus, X, Bell, Webhook, Mail, Loader2 } from 'lucide-react';

interface CompanySettings {
  auto_takedown_enabled: boolean;
  takedown_threshold: number;
  takedown_severity_filter: string;
  notification_webhook_url: string | null;
  notification_email: string | null;
}

function NotificationsSection({ settings, onUpdate, saving }: {
  settings: CompanySettings | undefined;
  onUpdate: (field: string, value: string) => Promise<void>;
  saving: boolean;
}) {
  // Track se o usuario realmente editou o campo (vs apenas focou/desfocou)
  const [webhookDirty, setWebhookDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [email, setEmail] = useState('');
  const [testing, setTesting] = useState<'webhook' | 'email' | null>(null);
  const { toast } = useToast();

  const testWebhook = async () => {
    setTesting('webhook');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      const { data, error } = await supabase.functions.invoke('compliance-scan', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { test_webhook: true },
      });
      if (error) throw error;
      toast({ title: data?.success ? 'Webhook OK' : 'Webhook falhou', variant: data?.success ? 'default' : 'destructive' });
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
    setTesting(null);
  };

  const testEmail = async () => {
    setTesting('email');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      const { data, error } = await supabase.functions.invoke('compliance-scan', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { test_email: true },
      });
      if (error) throw error;
      toast({ title: data?.success ? 'Email enviado' : 'Email falhou', variant: data?.success ? 'default' : 'destructive' });
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
    setTesting(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notificações
        </CardTitle>
        <CardDescription>
          Receba alertas quando anúncios forem pausados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Webhook className="w-4 h-4" />
            Webhook URL
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://hooks.slack.com/services/..."
              defaultValue={settings?.notification_webhook_url ?? ''}
              onChange={(e) => { setWebhookUrl(e.target.value); setWebhookDirty(true); }}
              onBlur={() => {
                if (webhookDirty) { onUpdate('notification_webhook_url', webhookUrl); setWebhookDirty(false); }
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={testWebhook}
              disabled={!settings?.notification_webhook_url || testing === 'webhook'}
            >
              {testing === 'webhook' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Testar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">POST JSON com detalhes do takedown. Compativel com Slack, Discord, Zapier, etc.</p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email de alerta
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="gestor@empresa.com"
              defaultValue={settings?.notification_email ?? ''}
              onChange={(e) => { setEmail(e.target.value); setEmailDirty(true); }}
              onBlur={() => {
                if (emailDirty) { onUpdate('notification_email', email); setEmailDirty(false); }
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={testEmail}
              disabled={!settings?.notification_email || testing === 'email'}
            >
              {testing === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Testar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Receba email com detalhes da violacao em ate 2 minutos apos o takedown.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComplianceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<CompanySettings & { _companyId?: string }>({
    queryKey: ['company-compliance-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('companies')
        .select('id, auto_takedown_enabled, takedown_threshold, takedown_severity_filter, notification_webhook_url, notification_email') as any)
        .single() as any;
      if (error) throw error;
      return { ...data, _companyId: data.id } as CompanySettings & { _companyId: string };
    },
  });

  const { brandGuide, updateBrandGuide } = useBrandGuide();
  const [saving, setSaving] = useState(false);
  const [newColor, setNewColor] = useState('#');
  const [logoUrl, setLogoUrl] = useState('');

  const updateSetting = async (field: string, value: boolean | number | string) => {
    const companyId = (settings as { _companyId?: string })?._companyId;
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ [field]: value } as never)
      .eq('id', companyId);
    setSaving(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['company-compliance-settings'] });
    }
  };

  const addColor = () => {
    const hex = newColor.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      toast({ title: 'Formato invalido', description: 'Use formato hex: #FF5733', variant: 'destructive' });
      return;
    }
    const current = brandGuide?.brand_colors ?? [];
    if (current.length >= 10) {
      toast({ title: 'Limite atingido', description: 'Máximo 10 cores.', variant: 'destructive' });
      return;
    }
    updateBrandGuide.mutate({ brand_colors: [...current, hex.toUpperCase()] });
    setNewColor('#');
  };

  const removeColor = (idx: number) => {
    const current = [...(brandGuide?.brand_colors ?? [])];
    current.splice(idx, 1);
    updateBrandGuide.mutate({ brand_colors: current });
  };

  const saveLogo = () => {
    if (logoUrl && !/^https?:\/\/.+/.test(logoUrl)) {
      toast({ title: 'URL invalida', description: 'Insira uma URL valida comecando com http/https.', variant: 'destructive' });
      return;
    }
    updateBrandGuide.mutate({ brand_logo_url: logoUrl || null });
  };

  return (
    <div className="space-y-6">
      {/* Auto-takedown card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Auto-Takedown
          </CardTitle>
          <CardDescription>
            Pausa automaticamente anúncios com score abaixo do threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="takedown-toggle" className="font-medium">
              Habilitar pausa automática
            </Label>
            <Switch
              id="takedown-toggle"
              checked={settings?.auto_takedown_enabled ?? false}
              onCheckedChange={(v) => updateSetting('auto_takedown_enabled', v)}
              disabled={saving}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Threshold de pausa
              </Label>
              <span className="text-sm font-mono font-bold">{settings?.takedown_threshold ?? 50}/100</span>
            </div>
            <Slider
              value={[settings?.takedown_threshold ?? 50]}
              onValueCommit={(v) => updateSetting('takedown_threshold', v[0])}
              min={10}
              max={90}
              step={5}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label>Filtro de severidade</Label>
            <Select
              value={settings?.takedown_severity_filter ?? 'critical'}
              onValueChange={(v) => updateSetting('takedown_severity_filter', v)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Apenas violacoes críticas</SelectItem>
                <SelectItem value="any">Qualquer violacao (score abaixo do threshold)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              "Apenas críticas" = so pausa se houver pelo menos 1 violacao critical, alem do score estar abaixo do threshold.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Brand Guide
          </CardTitle>
          <CardDescription>
            Cores da marca e logo para validação visual dos criativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Colors */}
          <div className="space-y-3">
            <Label>Cores da marca (hex)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(brandGuide?.brand_colors ?? []).map((color, i) => (
                <Badge key={i} variant="outline" className="gap-1.5 pr-1">
                  <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: color }} />
                  {color}
                  <button onClick={() => removeColor(i)} className="ml-1 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {(brandGuide?.brand_colors ?? []).length === 0 && (
                <span className="text-sm text-muted-foreground">Nenhuma cor cadastrada</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="#FF5733"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addColor()}
                className="w-[140px]"
              />
              <Button variant="outline" size="sm" onClick={addColor} disabled={updateBrandGuide.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Logo da marca
            </Label>
            {brandGuide?.brand_logo_url && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <img src={brandGuide.brand_logo_url} alt="Logo" className="w-12 h-12 object-contain rounded" />
                <span className="text-sm truncate flex-1">{brandGuide.brand_logo_url}</span>
                <Button variant="ghost" size="sm" onClick={() => updateBrandGuide.mutate({ brand_logo_url: null })}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="https://exemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={saveLogo} disabled={updateBrandGuide.isPending}>
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <NotificationsSection settings={settings} onUpdate={updateSetting} saving={saving} />

      {/* Blacklist manager */}
      <BlacklistManager />
    </div>
  );
}
