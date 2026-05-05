// Resolve nomes de cidades (briefing/conversa) em keys Meta Ads (Targeting Search API).
// Uso: propose_campaign antes de persistir proposal.
// Docs: https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search

import type { Archetype, AudiencePayload } from './campaign-proposal-helpers.ts';

const GRAPH_VERSION = Deno.env.get('META_GRAPH_API_VERSION') ?? 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DEFAULT_RADIUS_KM = 25;

export interface MetaCityMatch {
  key: string;
  name: string;
}

/**
 * Busca localidade tipo "city" via Graph search (adgeolocation).
 */
export async function searchMetaAdGeoCity(
  accessToken: string,
  query: string,
  countryCode = 'BR',
): Promise<MetaCityMatch | null> {
  const q = query.trim();
  if (!q) return null;

  const params = new URLSearchParams({
    type: 'adgeolocation',
    q,
    location_types: JSON.stringify(['city']),
    country_code: countryCode,
    access_token: accessToken,
  });

  const url = `${GRAPH_BASE}/search?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const body = await res.json().catch(() => ({})) as {
    data?: Array<{ key: string | number; name?: string; type?: string; country_code?: string }>;
    error?: { message?: string };
  };

  if (!res.ok || body.error) {
    console.warn('[meta-geo-resolve] search failed', res.status, body.error?.message ?? body);
    return null;
  }

  const rows = body.data ?? [];
  if (rows.length === 0) return null;

  const normalizedQ = normalizeForMatch(q);
  const firstToken = normalizedQ.split(',')[0]?.trim() ?? normalizedQ;

  const bra = rows.find((r) => String(r.country_code ?? '').toUpperCase() === countryCode.toUpperCase());
  const pool = bra != null ? rows.filter((r) => String(r.country_code ?? '').toUpperCase() === countryCode.toUpperCase()) : rows;

  const byName = pool.find((r) => normalizeForMatch(String(r.name ?? '')).includes(firstToken));

  const pick = byName ?? pool[0] ?? rows[0];
  const key = String(pick.key ?? '');
  if (!key || !/\d/.test(key)) return null;

  return { key, name: String(pick.name ?? q) };
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Heuristica BR: país livre texto do briefing vs ISO2 */
export function briefingCountryToIso(countryRaw: string | undefined | null): string | null {
  if (!countryRaw?.trim()) return null;
  const c = normalizeForMatch(countryRaw);
  if (c === 'brasil' || c === 'brazil' || c === 'br') return 'BR';
  return null;
}

/** Monta query "Cidade, UF" quando possível */
export function geoQueryFromBriefingLocation(loc: {
  country?: string;
  state?: string;
  city?: string;
} | null | undefined): { query: string; countryCode: string } | null {
  const city = loc?.city?.trim();
  if (!city) return null;
  const iso = briefingCountryToIso(loc?.country) ?? 'BR';
  const st = loc?.state?.trim();
  const query = st ? `${city}, ${st}` : city;
  return { query, countryCode: iso };
}

export interface BriefingAudienceShape {
  location?: { country?: string; state?: string; city?: string };
}

const CITY_KEY_REGEX = /^\d{4,}$/;

/**
 * Preenche `geo_locations.cities` com key Meta quando fizer sentido:
 * - dica livre na conversa (prioridade); ou
 * - arquetipo `small_local_business` + cidade no briefing (país tratado como BR quando omitido).
 */
export async function enrichAudienceWithLocalGeo(options: {
  audience: AudiencePayload;
  archetype: Archetype | null | undefined;
  briefingAudience: BriefingAudienceShape | null | undefined;
  metaToken: string;
  conversationCityHint?: string | null;
}): Promise<{ audience: AudiencePayload; geoSummary?: string }> {
  const { audience, archetype, briefingAudience, metaToken } = options;

  const existing = audience.geo_locations?.cities ?? [];
  const hasValidKeys = existing.length > 0 &&
    existing.every((c) => Boolean(c.key) && CITY_KEY_REGEX.test(c.key));

  if (hasValidKeys) return { audience };

  const wantLocalArchetype = archetype === 'small_local_business';
  const fromBriefing = geoQueryFromBriefingLocation(briefingAudience?.location ?? null);
  const hint = options.conversationCityHint?.trim();

  let searchQuery: string | null = null;
  let countryCode = 'BR';

  if (hint) {
    searchQuery = hint;
  } else if (wantLocalArchetype && fromBriefing) {
    searchQuery = fromBriefing.query;
    countryCode = fromBriefing.countryCode;
  }

  if (!searchQuery) return { audience };

  const match = await searchMetaAdGeoCity(metaToken, searchQuery, countryCode);
  if (!match) return { audience };

  const countries = audience.geo_locations?.countries?.length
    ? audience.geo_locations.countries
    : ['BR'];

  const next: AudiencePayload = {
    ...audience,
    geo_locations: {
      ...audience.geo_locations,
      countries,
      cities: [{ key: match.key, radius: DEFAULT_RADIUS_KM, distance_unit: 'kilometer' }],
    },
  };

  return {
    audience: next,
    geoSummary: `${match.name} e regiao (~${DEFAULT_RADIUS_KM} km)`,
  };
}
