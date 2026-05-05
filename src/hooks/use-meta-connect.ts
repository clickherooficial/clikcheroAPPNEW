import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { META_OAUTH_RETURN_STORAGE_KEY } from '@/lib/oauth-meta-return';

interface MetaIntegration {
  id: string;
  platform: string;
  account_id: string | null;
  account_name: string | null;
  account_status: string | null;
  business_id: string | null;
  business_name: string | null;
  facebook_user_id: string | null;
  facebook_user_name: string | null;
  token_expires_at: string | null;
  status: string | null;
  scan_interval_hours: number | null;
  next_scan_at: string | null;
  last_sync: string | null;
  connected_by_user_id: string | null;
  connected_by_user_name: string | null;
  created_at: string | null;
}

export function useMetaConnect() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current Meta integration status
  const {
    data: integration,
    isPending: integrationBootstrap,
    error,
  } = useQuery<MetaIntegration | null>({
    queryKey: ['meta-integration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select(
          'id, platform, account_id, account_name, account_status, business_id, business_name, facebook_user_id, facebook_user_name, token_expires_at, status, scan_interval_hours, next_scan_at, last_sync, connected_by_user_id, connected_by_user_name, created_at'
        )
        .eq('platform', 'meta')
        .maybeSingle();

      if (error) throw error;
      return data as MetaIntegration | null;
    },
    staleTime: 30_000,
  });

  /** Só primeira carga: refetch pós-OAuth não dispara spinner em tela cheia dentro do wizard. */
  const isLoading = integrationBootstrap;

  // Start OAuth flow
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('meta-oauth-start', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data as { url: string; state: string };
    },
    onSuccess: (data) => {
      try {
        sessionStorage.setItem(
          META_OAUTH_RETURN_STORAGE_KEY,
          `${window.location.pathname}${window.location.search}`,
        );
      } catch {
        /* ignore */
      }
      // Popup flow — abre Meta em popup, callback redireciona pra /oauth/meta/complete
      // (rota do proprio app — nao tem cross-origin, nao mostra HTML cru)
      // Essa rota faz postMessage pro opener e fecha o popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.url,
        'meta-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description: 'Permita popups para conectar a conta Meta.',
          variant: 'destructive',
        });
        return;
      }

      // Polling de fallback: se o popup fechou (usuario cancelou ou postMessage falhou)
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);
          queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
          queryClient.invalidateQueries({ queryKey: ['meta-assets'] });
        }
      }, 500);

      // Listener do postMessage vindo de /oauth/meta/complete
      const messageHandler = (event: MessageEvent) => {
        // SECURITY: so aceita messages da mesma origem
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'meta-oauth-success') {
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);
          try { popup.close(); } catch { /* empty */ }
          queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
          queryClient.invalidateQueries({ queryKey: ['meta-assets'] });
          toast({
            title: 'Meta conectado!',
            description: `${event.data.accounts || 0} conta(s) encontrada(s). Selecione quais deseja usar.`,
          });
          // Dispatch evento global pra Integrations.tsx abrir o MetaAssetPickerModal
          window.dispatchEvent(new CustomEvent('meta-oauth-completed', {
            detail: { accounts: event.data.accounts ?? 0 },
          }));
        } else if (event.data?.type === 'meta-oauth-error') {
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);
          try { popup.close(); } catch { /* empty */ }
          toast({
            title: 'Erro na conexao',
            description: event.data.error || 'Tente novamente.',
            variant: 'destructive',
          });
        }
      };
      window.addEventListener('message', messageHandler);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao conectar Meta',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Sync campaigns + metrics + creatives from Meta
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('meta-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data as { success: boolean; stats: { accounts_processed: number; campaigns_synced: number; metrics_synced: number; creatives_synced: number; errors: string[] } };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['creatives'] });
      toast({
        title: 'Sincronizacao concluida',
        description: `${data.stats.campaigns_synced} campanhas, ${data.stats.metrics_synced} metricas, ${data.stats.creatives_synced} criativos.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na sincronizacao',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Update scan interval (hours)
  const updateScanIntervalMutation = useMutation({
    mutationFn: async (intervalHours: number) => {
      if (intervalHours < 6 || intervalHours > 168) {
        throw new Error('Intervalo deve estar entre 6 e 168 horas');
      }
      const nextScanAt = new Date(Date.now() + intervalHours * 3600_000).toISOString();
      const { error } = await supabase
        .from('integrations')
        .update({
          scan_interval_hours: intervalHours,
          next_scan_at: nextScanAt,
        })
        .eq('platform', 'meta');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      queryClient.invalidateQueries({ queryKey: ['meta-scan-health'] });
      toast({
        title: 'Intervalo atualizado',
        description: 'A proxima varredura ja foi reagendada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar intervalo',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('meta-oauth-disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      toast({
        title: 'Meta desconectado',
        description: 'Integração removida com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao desconectar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Computed state
  const isConnected = integration?.status === 'active';
  const isExpiringSoon = integration?.status === 'expiring_soon';
  const isExpired = integration?.status === 'expired';

  const daysUntilExpiry = integration?.token_expires_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(integration.token_expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return {
    integration,
    isLoading,
    error,
    isConnected,
    isExpiringSoon,
    isExpired,
    daysUntilExpiry,
    connect: () => connectMutation.mutate(),
    disconnect: () => disconnectMutation.mutate(),
    sync: () => syncMutation.mutate(),
    updateScanInterval: (hours: number) => updateScanIntervalMutation.mutate(hours),
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isSyncing: syncMutation.isPending,
    isUpdatingScanInterval: updateScanIntervalMutation.isPending,
  };
}
