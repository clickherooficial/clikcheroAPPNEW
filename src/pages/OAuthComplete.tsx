import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * OAuth Complete — rota que abre dentro do popup OAuth.
 * Le query params do redirect Supabase, envia postMessage pro opener
 * (janela pai do app) e fecha o popup.
 *
 * Vantagem vs HTML servido pela Edge Function:
 * - Mesma origem do app → window.opener sem restricoes cross-origin
 * - Codigo JS do proprio app → extensoes nao bloqueiam
 * - Rotas React Router → sem HTML cru se algo falhar
 */

export default function OAuthComplete() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');
    const accounts = searchParams.get('accounts');

    try {
      if (window.opener && !window.opener.closed) {
        const msg = success === 'true'
          ? { type: 'meta-oauth-success', accounts: accounts ? parseInt(accounts, 10) : 0 }
          : { type: 'meta-oauth-error', error: error ?? 'Erro desconhecido' };
        // Target: propria origem (seguro, nao vaza para outras janelas)
        window.opener.postMessage(msg, window.location.origin);
      }
    } catch (e) {
      // Mesmo que postMessage falhe, tenta fechar
      console.error('[oauth-complete] postMessage failed:', e);
    }

    // Fecha o popup
    const closeTimer = setTimeout(() => {
      try { window.close(); } catch { /* empty */ }
    }, 300);

    return () => clearTimeout(closeTimer);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Concluindo conexão...
      </div>
    </div>
  );
}
