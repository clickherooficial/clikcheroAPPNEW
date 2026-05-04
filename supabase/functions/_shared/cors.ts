// CORS headers for Supabase Edge Functions
// Origens permitidas sao lidas do env ALLOWED_ORIGINS (comma-separated)
// Default inclui localhost dev + placeholder prod.
const DEFAULT_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getAllowedOrigins(): string[] {
  const fromEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (fromEnv) {
    return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const appUrl = Deno.env.get('APP_URL');
  if (appUrl) {
    return [...DEFAULT_ORIGINS, appUrl];
  }
  return DEFAULT_ORIGINS;
}

// Hostnames permitidos via wildcard (cobre preview URLs que mudam a cada deploy)
const ALLOWED_HOST_SUFFIXES = ['.lovable.app', '.lovable.dev'];
// Hostnames de dev locais — qualquer porta liberada (vite incrementa 8080->8081->...)
const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (LOCAL_DEV_HOSTNAMES.has(hostname)) return true;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function getCorsHeaders(req?: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const origin = req?.headers.get('origin') ?? '';
  const allowedOrigin = isOriginAllowed(origin, allowedOrigins) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
