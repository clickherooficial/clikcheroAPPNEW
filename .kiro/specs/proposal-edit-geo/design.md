# Design — proposal-edit-geo

> Status: APPROVED (fast-track)

## Visão geral
Reutilizar o helper existente `searchMetaAdGeoCity` (em `_shared/meta-geo-resolve.ts`) por meio de uma nova Edge Function fina `meta-geo-search` invocável pelo frontend. O modal `CampaignProposalEditor` adiciona campo de texto "Localidade", e ao Salvar, se o texto mudou, resolve a cidade antes de aplicar o patch via `useCampaignProposal.edit()`.

## Componentes alterados/novos

### Nova Edge Function: `supabase/functions/meta-geo-search/index.ts`
- Método: `POST`
- Body: `{ query: string; country_code?: string }` (default `BR`)
- Auth: `requireTenant` (extrai `companyId`)
- Fluxo:
  1. Zod parse → 422 `validation` se falhar.
  2. SELECT `integrations.access_token` para `(company_id, platform=meta)` → 404 `no_meta_connection`.
  3. RPC `decrypt_meta_token` → 500 `meta_api` se falha.
  4. `searchMetaAdGeoCity(token, query, country_code)` → 404 `not_found` se null.
  5. Retorna `{ key, name, summary: "<name> e regiao (~25 km)" }`.
- Sem RLS extra (a query usa service role com filtro por companyId).
- Sem custos de quota; é só um GET ao Graph.

### Novo hook: `src/hooks/use-meta-geo-search.ts`
- `useMetaGeoSearch(): { resolveCity: (query: string) => Promise<Result<{key,name,summary}, GeoError>> }`
- `GeoError = { kind: 'not_found' | 'no_meta_connection' | 'meta_api' | 'validation' | 'network'; message: string }`
- Usa `supabase.functions.invoke<>('meta-geo-search', { body })`. Mapping de erro idêntico ao `mapEdgeError` em use-creatives.

### Alteração: `src/components/chat/CampaignProposalEditor.tsx`
- Novo state `locationQuery` inicializado com `initial.audience_geo_summary ?? deriveLabelFromCities(initial.audience.geo_locations.cities)`.
- Novo input "Localidade" (logo abaixo do bloco de idade).
- Em `handleSave`:
  - Se `locationQuery.trim()` não mudou em relação ao inicial → segue fluxo atual.
  - Senão, chama `resolveCity(locationQuery.trim())`. Se erro → toast e RETURN (não salva).
  - Se sucesso → adiciona ao patch:
    ```ts
    audience: { ...patch.audience, geo_locations: {
      ...initial.audience.geo_locations,
      countries: initial.audience.geo_locations.countries?.length ? initial.audience.geo_locations.countries : ['BR'],
      cities: [{ key, radius: 25, distance_unit: 'kilometer' }],
    }},
    audience_geo_summary: summary,
    ```
- Botão Salvar exibe spinner enquanto resolve.

### Alteração: `src/types/campaign-proposal.ts`
- Sem mudança (todos os campos já existem).

## Trade-offs
- **Resolve sob demanda no Salvar** (vs autocomplete): -1 ida ao servidor por edição, +1 ms de latência ao salvar. Aceitável para MVP — autocomplete fica para próxima iteração.
- **Raio fixo 25 km**: matches a heurística do `enrichAudienceWithLocalGeo`. Editável depois.
- **País fixo BR**: 99% dos clientes brasileiros; expansão futura via `country_code` no body.
- **Tenant guard via `requireTenant`** ao invés de `verifyJWT` direto: mantém consistência com outras edges (ex: creative-iterate).

## Erros não tratados
- Token Meta expirado: o `searchMetaAdGeoCity` retorna `null` (warn no console). Para o usuário, vira `not_found` — mensagem genérica. Aceitável até termos refresh-token automático.

## Migration
Nenhuma. O campo `audience_geo_summary` já existe em `payload_jsonb`.
