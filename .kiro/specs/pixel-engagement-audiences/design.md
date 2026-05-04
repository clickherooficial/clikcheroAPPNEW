# Design — pixel-engagement-audiences (resumido, fast-track)

## Schema

### Migration `20260504000002_audience_sources_cache.sql`

```sql
CREATE TABLE meta_audience_sources_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pixel','page','ig_business','video','lead_form')),
  external_id text NOT NULL,
  name text NOT NULL,
  metadata jsonb,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (company_id, kind, external_id)
);

CREATE INDEX idx_audience_sources_company_kind ON meta_audience_sources_cache(company_id, kind);

ALTER TABLE meta_audience_sources_cache ENABLE ROW LEVEL SECURITY;
-- RLS scoped por current_organization_id (mesmo padrao)
```

## Helper `_shared/audience-rule-builder.ts`

Constroi `rule` jsonb a partir de payloads tipados:

```typescript
buildPixelRule({ pixel_id, event, url_contains?, retention_days, exclude_event? }): jsonb
buildEngagementRule({ source_kind, source_id, template, template_params?, retention_days }): jsonb
```

## Edge Fns

### `meta-list-audience-sources`
- Pega pixels (`/act_{id}/adspixels`), pages (`/me/accounts`), IG (`/me/accounts/{id}/instagram_accounts`), videos recentes (`/{page_id}/videos?limit=50`), lead forms (`/{page_id}/leadgen_forms`)
- Upserta tudo em meta_audience_sources_cache com fetched_at=now()
- Retorna mapping organizado

### `meta-audience-create-rule`
- Aceita discriminated union: `{ kind: 'pixel', ... }` | `{ kind: 'engagement', ... }`
- Constroi rule via helper
- POST `/act_{id}/customaudiences` com `subtype` apropriado (WEBSITE pra pixel, ENGAGEMENT pra engagement) e `rule` jsonb
- Insere em meta_audiences

## Tools no chat

- `create_pixel_audience` — schema com pixel_id, event, url_contains, retention_days, exclude_event
- `create_engagement_audience` — schema com source_kind, source_id, template, template_params, retention_days

## Frontend

- `src/hooks/use-audience-sources.ts` — useAudienceSources (query) + useRefreshSources (mutation)
- `src/types/pixel-audiences.ts` — tipos
- `src/components/audiences/PixelRuleBuilder.tsx` — pixel dropdown + event combo + url contains + retention slider
- `src/components/audiences/EngagementPicker.tsx` — kind radio + source select + template select
- Substituir tabs no `CreateAudienceDialog` — remover "Lock" do Pixel, adicionar Engagement

## Decisoes

- **Cache 1h em meta_audience_sources_cache** — Graph API rate-limited; refresh manual via botao
- **Discriminated union no Edge `meta-audience-create-rule`** — single Edge Fn handle pixel + engagement evita duplicar safety rails wrap
- **Eventos Meta hardcoded no schema da tool** — lista finita oficial; melhor que aceitar string aberta
