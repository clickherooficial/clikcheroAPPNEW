// meta-geo-search — resolve "Cidade" / "Cidade, UF" em city key Meta.
// Spec: .kiro/specs/proposal-edit-geo/
//
// Usado pelo modal CampaignProposalEditor para permitir que o usuario
// edite a localidade do targeting da proposta.
//
// Pipeline:
//   1. Tenant guard (JWT -> companyId)
//   2. Zod parse { query, country_code? }
//   3. SELECT integrations.access_token p/ company+meta -> 404 no_meta_connection
//   4. RPC decrypt_meta_token
//   5. searchMetaAdGeoCity -> 404 not_found se null
//   6. Retorna { key, name, summary }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireTenant } from '../_shared/tenant-guard.ts';
import { searchMetaAdGeoCity } from '../_shared/meta-geo-resolve.ts';

const DEFAULT_RADIUS_KM = 25;

const RequestSchema = z.object({
  query: z.string().min(2).max(120),
  country_code: z.string().length(2).optional(),
});

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const guard = await requireTenant(req, admin, { cors });
  if (!guard.ok) return guard.response;
  const { companyId } = guard.value;

  let body: unknown;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'validation', issues: parsed.error.flatten() }, 422, cors);
  }
  const { query, country_code } = parsed.data;

  const { data: integration } = await admin
    .from('integrations')
    .select('access_token')
    .eq('company_id', companyId)
    .eq('platform', 'meta')
    .single();
  if (!integration?.access_token) {
    return jsonResponse({ error: 'no_meta_connection' }, 404, cors);
  }

  const { data: decrypted } = await admin.rpc('decrypt_meta_token', {
    encrypted_token: integration.access_token,
  });
  if (!decrypted) {
    return jsonResponse({ error: 'meta_api', message: 'Falha ao descriptografar token Meta.' }, 500, cors);
  }

  const match = await searchMetaAdGeoCity(decrypted as string, query, country_code ?? 'BR');
  if (!match) {
    return jsonResponse(
      { error: 'not_found', message: `Localidade "${query}" nao encontrada no Meta.` },
      404, cors,
    );
  }

  return jsonResponse(
    {
      key: match.key,
      name: match.name,
      summary: `${match.name} e regiao (~${DEFAULT_RADIUS_KM} km)`,
      radius_km: DEFAULT_RADIUS_KM,
    },
    200, cors,
  );
});
