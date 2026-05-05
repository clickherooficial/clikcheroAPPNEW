import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { META_OAUTH_RETURN_STORAGE_KEY } from '@/lib/oauth-meta-return';

function safeReturnBase(): string {
  try {
    const raw = sessionStorage.getItem(META_OAUTH_RETURN_STORAGE_KEY)?.trim();
    sessionStorage.removeItem(META_OAUTH_RETURN_STORAGE_KEY);
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('/oauth/meta/complete')) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return '/integrations';
}

function appendReturnParams(
  basePathWithQuery: string,
  extra: Record<string, string>,
): string {
  const [pathRaw, fragment] = basePathWithQuery.split('#');
  const hash = fragment != null ? `#${fragment}` : '';
  const [pathnameOnly, rawQuery = ''] = pathRaw.includes('?') ? pathRaw.split('?') : [pathRaw, ''];
  const params = new URLSearchParams(rawQuery);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return `${pathnameOnly}${qs ? `?${qs}` : ''}${hash}`;
}

/**
 * OAuth Complete — fluxo Meta após Edge Function redirect.
 * - Popup: postMessage ao opener + fecha.
 * - Mesma aba (sem opener): volta à rota salva + flags para disparar mesmo UX do wizard/integrações.
 */
export default function OAuthComplete() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');
    const accounts = searchParams.get('accounts');

    const hasOpener = !!(window.opener && !window.opener.closed);

    try {
      if (hasOpener) {
        const msg =
          success === 'true'
            ? {
                type: 'meta-oauth-success' as const,
                accounts: accounts ? parseInt(accounts, 10) : 0,
              }
            : { type: 'meta-oauth-error' as const, error: error ?? 'Erro desconhecido' };
        window.opener!.postMessage(msg, window.location.origin);
      }
    } catch (e) {
      console.error('[oauth-complete] postMessage failed:', e);
    }

    const closeTimer = setTimeout(() => {
      if (hasOpener) {
        try {
          window.close();
        } catch {
          /* empty */
        }
        return;
      }

      try {
        const base = safeReturnBase();
        if (success === 'true') {
          window.location.replace(
            appendReturnParams(base, {
              oauth_meta_done: '1',
              ...(accounts != null ? { oauth_accounts: accounts } : {}),
            }),
          );
        } else {
          window.location.replace(
            appendReturnParams(base, {
              oauth_meta_error: encodeURIComponent(error ?? 'Erro OAuth'),
            }),
          );
        }
      } catch {
        window.location.replace('/');
      }
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
