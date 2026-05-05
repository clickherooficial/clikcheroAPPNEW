import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMetaConnect } from '@/hooks/use-meta-connect';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetaAssetPickerModal } from '@/components/meta/MetaAssetPickerModal';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
  Unplug,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { ScanHealthCard } from '@/components/meta/ScanHealthCard';

const Integrations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    integration,
    isLoading,
    isConnected,
    isExpiringSoon,
    isExpired,
    daysUntilExpiry,
    connect,
    disconnect,
    sync,
    isConnecting,
    isDisconnecting,
    isSyncing,
    updateScanInterval,
    isUpdatingScanInterval,
  } = useMetaConnect();

  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    const handler = () => setTimeout(() => setShowSelector(true), 300);
    window.addEventListener('meta-oauth-completed', handler);
    return () => window.removeEventListener('meta-oauth-completed', handler);
  }, []);

  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');

    if (success === 'true') {
      setSearchParams({});
      setTimeout(() => setShowSelector(true), 300);
    } else if (error) {
      toast({
        title: 'Erro na conexão Meta',
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast]);

  // Meta OAuth mesmo-navegador (voltou para /integrations?oauth_meta_*)
  useEffect(() => {
    const oauthDone = searchParams.get('oauth_meta_done');
    const oauthErr = searchParams.get('oauth_meta_error');
    if (oauthDone !== '1' && oauthErr == null) return;

    const next = new URLSearchParams(searchParams);
    if (oauthDone === '1') {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      queryClient.invalidateQueries({ queryKey: ['meta-assets'] });
      setTimeout(() => setShowSelector(true), 300);
      next.delete('oauth_meta_done');
      next.delete('oauth_accounts');
    }
    if (oauthErr != null && oauthErr !== '') {
      toast({
        title: 'Erro na conexão Meta',
        description: decodeURIComponent(oauthErr),
        variant: 'destructive',
      });
      next.delete('oauth_meta_error');
    }
    const qs = next.toString();
    navigate(qs ? `/integrations?${qs}` : '/integrations', { replace: true });
  }, [searchParams, navigate, queryClient, toast]);

  const getStatusBadge = () => {
    if (isConnected) {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
          Conectado
        </Badge>
      );
    }
    if (isExpiringSoon) {
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
          Expira em {daysUntilExpiry} dias
        </Badge>
      );
    }
    if (isExpired) {
      return (
        <Badge variant="danger" className="gap-1">
          <XCircle className="h-3 w-3" strokeWidth={2.5} />
          Expirado
        </Badge>
      );
    }
    return <Badge variant="outline">Desconectado</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="text-sm font-semibold text-foreground">Integrações</h1>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6 xl:p-8">
        <PageHeader
          title="Integrações"
          description="Conecte plataformas de anúncio para importar campanhas, métricas e insights"
        />

        {/* Meta Ads Card */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 ring-1 ring-[#1877F2]/15">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"
                      fill="#1877F2"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base tracking-tight">Meta Ads</CardTitle>
                  <CardDescription className="text-[13px]">
                    Conecte contas de anúncio do Facebook e Instagram
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : integration && (isConnected || isExpiringSoon || isExpired) ? (
              <>
                {/* Connected info */}
                <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <InfoField label="Conta Meta" value={integration.facebook_user_name || '—'} />
                    <InfoField label="Ad Account" value={integration.account_name || '—'} />
                    <InfoField label="Business" value={integration.business_name || '—'} />
                    <InfoField
                      label="Expira em"
                      value={daysUntilExpiry !== null ? `${daysUntilExpiry} dias` : '—'}
                      mono
                    />
                  </div>
                  {integration.last_sync && (
                    <p className="border-t border-border/50 pt-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                      Última sync: {new Date(integration.last_sync).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>

                {isExpiringSoon && (
                  <Alert tone="warning" icon={AlertTriangle}>
                    Seu token expira em {daysUntilExpiry} dias. Reconecte para renovar.
                  </Alert>
                )}

                {isExpired && (
                  <Alert tone="danger" icon={XCircle}>
                    Token expirado. Reconecte sua conta Meta para continuar usando.
                  </Alert>
                )}

                <ScanHealthCard />

                {/* Scan interval */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-sm text-foreground/80">Intervalo de varredura automática</div>
                  <Select
                    value={String(integration?.scan_interval_hours ?? 24)}
                    onValueChange={(v) => updateScanInterval(Number(v))}
                    disabled={isUpdatingScanInterval || !isConnected}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">A cada 6 horas</SelectItem>
                      <SelectItem value="12">A cada 12 horas</SelectItem>
                      <SelectItem value="24">A cada 24 horas</SelectItem>
                      <SelectItem value="48">A cada 48 horas</SelectItem>
                      <SelectItem value="72">A cada 72 horas</SelectItem>
                      <SelectItem value="168">Semanal (168h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowSelector(!showSelector)}
                    variant="outline"
                    className="min-w-[140px] flex-1"
                  >
                    <Settings2 className="h-4 w-4" />
                    {showSelector ? 'Fechar Ativos' : 'Gerenciar Ativos'}
                  </Button>
                  <Button
                    onClick={sync}
                    disabled={isSyncing || !isConnected}
                    className="min-w-[140px] flex-1"
                  >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isSyncing ? 'Sincronizando' : 'Sincronizar'}
                  </Button>
                  {(isExpiringSoon || isExpired) && (
                    <Button onClick={connect} disabled={isConnecting} className="min-w-[140px] flex-1">
                      {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                      <ExternalLink className="h-4 w-4" />
                      Reconectar
                    </Button>
                  )}
                  <Button
                    onClick={disconnect}
                    disabled={isDisconnecting}
                    variant="outline"
                    className="min-w-[140px] flex-1 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Unplug className="h-4 w-4" />
                    Desconectar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center">
                  <p className="text-sm text-foreground/80">
                    Conecte sua conta Meta Ads para importar campanhas, métricas e insights automaticamente.
                  </p>
                  <ul className="flex flex-wrap justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <li className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">Campanhas</li>
                    <li className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">Métricas</li>
                    <li className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">Business Manager</li>
                    <li className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">Criativos</li>
                  </ul>
                </div>

                <Button onClick={connect} disabled={isConnecting} size="lg" className="w-full">
                  {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <ExternalLink className="h-4 w-4" />
                  Conectar Meta Ads
                </Button>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      <MetaAssetPickerModal
        open={showSelector}
        onOpenChange={setShowSelector}
        onComplete={() => {
          setShowSelector(false);
          toast({
            title: 'Ativos conectados!',
            description: 'Dados sendo sincronizados em background. O Dashboard sera populado em breve.',
          });
        }}
      />
    </div>
  );
};

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-[13px] tabular-nums text-foreground" : "truncate text-[13px] text-foreground"}>{value}</div>
    </div>
  );
}

function Alert({ tone, icon: Icon, children }: { tone: 'warning' | 'danger'; icon: React.ElementType; children: React.ReactNode }) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  };
  const iconColor = tone === 'warning' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${styles[tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} strokeWidth={2} />
      <p className="text-sm">{children}</p>
    </div>
  );
}

export default Integrations;
