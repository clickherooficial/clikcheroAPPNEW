# Requirements — pixel-engagement-audiences

> Sprint 4/8. Continuacao da audience-management (Sprint 3).
> Status: requirements (fast-track overnight)
> Idioma: pt-BR

## Visao

Sprint 3 entregou Custom (lista de clientes) e Lookalike. Faltam 2 tipos cruciais:

- **Pixel Custom Audiences** — derivadas de eventos do Pixel (visitou pagina X, adicionou ao carrinho, comprou). Meta popula automaticamente.
- **Engagement Custom Audiences** — derivadas de interacao social (curtiu IG, viu video Y%, abriu formulario de lead).

Ambas usam o campo `rule` jsonb de `meta_audiences`. Sao retroativas (Meta busca historico ate retention_days).

## Personas

- **Pedro** — "manda anuncio pra quem viu meu produto X mas nao comprou"
- **Filipe** — quer audiencia de quem viu 75% do video lancamento
- **Agente IA** — propoe via FURY: "criar audiencia de carrinho abandonado ultimos 14d toda segunda-feira"

## Requisitos funcionais

### R1 — Tool `create_pixel_audience` no chat

R1.1 SHALL aceitar:
- `name: string`
- `pixel_id: string` (external id do Meta Pixel)
- `event: string` (ex: 'PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration', 'ViewContent')
- `url_contains?: string` (filtro de URL — case-insensitive substring)
- `retention_days: int` (1-180 pra pixel)
- `exclude_event?: string` (audiencia A & nao B — ex: ViewContent E nao Purchase)

R1.2 Edge `meta-audience-create-rule` SHALL construir `rule` jsonb no formato Meta:
```
inclusions: { operator: 'or', rules: [{ event_sources: [{id, type:'pixel'}], retention_seconds, filter: {...} }] }
exclusions?: { operator: 'or', rules: [...] }   // se exclude_event
```

R1.3 SHALL passar por safety rails (action_kind='create_pixel_audience').

### R2 — Tool `create_engagement_audience` no chat

R2.1 SHALL aceitar:
- `name: string`
- `source_kind: 'page'|'ig_business'|'video'|'lead_form'|'event'`
- `source_id: string` (page_id, ig_user_id, video_id, etc)
- `template: 'page_engaged_users'|'page_visitors'|'video_viewers_X_pct'|'video_viewers_X_seconds'|'lead_form_opened'|'lead_form_submitted'|'event_responded'|'event_attended'`
- `template_params?: { percent?: 25|50|75|95; seconds?: number }` — pra video templates
- `retention_days: int` (1-365)

R2.2 Edge `meta-audience-create-rule` SHALL construir rule conforme template (mapeamento documentado).

R2.3 SHALL passar por safety rails (action_kind='create_engagement_audience').

### R3 — Listar pixels e fontes disponiveis

R3.1 SHALL prover Edge `meta-list-audience-sources` que retorna:
```
{
  pixels: [{ id, name, last_fired_time }],
  pages: [{ id, name }],
  ig_accounts: [{ id, username }],
  videos: [{ id, title, thumbnail_url }],   // ultimos 50
  lead_forms: [{ id, name, page_id }]
}
```

R3.2 SHALL cachear em meta_oauth_metadata ou similar (TTL 1h) pra evitar Graph spam.

### R4 — UI: PixelRuleBuilder + EngagementPicker

R4.1 Tab "Pixel" do `CreateAudienceDialog` (Sprint 3) deixa de ser placeholder e mostra:
- Select de pixel (com last_fired_time como hint)
- Combo de event (com helper "PageView e o evento basico — toda visita")
- Input de URL contains (opcional)
- Slider de retention 1-180d
- Checkbox "Excluir compradores" (auto-injeta exclude_event=Purchase quando event != Purchase)

R4.2 Nova tab "Engagement" mostra:
- Select de fonte (radio: Pagina FB / IG Business / Video / Lead Form)
- Combo da fonte concreta (ID + nome)
- Combo do template aplicavel
- Param adicional condicional (% pra video)

### R5 — Tabela de pixels local (cache)

R5.1 Migration cria tabela `meta_audience_sources_cache (company_id, kind, external_id, name, metadata jsonb, fetched_at)` com unique (company_id, kind, external_id).

R5.2 Edge `meta-list-audience-sources` upserta nesta tabela.

R5.3 RLS: SELECT/MODIFY scoped por company_id (mesmo padrao).

## Out of scope

- Audiencias dinamicas (rule baseada em parametros que mudam — ex: top X% spenders) — exige queries internas Meta nao publicamente documentadas
- App events (Sprint 6 — depende de mobile SDK integration nao prioritario hoje)
- Cross-pixel audiences (combinar 2+ pixels) — feature pouco usada, pode vir sob demanda

## Criterios de aceite

- [ ] `meta_audience_sources_cache` criada com RLS
- [ ] Edge `meta-list-audience-sources` retorna shape esperado
- [ ] Edge `meta-audience-create-rule` cria pixel audience com rule correta
- [ ] Edge `meta-audience-create-rule` cria engagement audience com rule correta
- [ ] 2 tools registradas: `create_pixel_audience`, `create_engagement_audience`
- [ ] UI com 2 tabs ativas (Pixel + Engagement) funcionais
- [ ] Build verde
