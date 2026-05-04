# Requirements — audience-management

> Sprint 3/8 do roadmap "agente de trafego completo".
> Depende de `agent-safety-rails` (Sprint 1) e `meta-edits-suite` (Sprint 2).
> Status: requirements
> Idioma: pt-BR (formato EARS)

## Visao

Hoje o agente edita campanha/adset/ad mas usa apenas **Detailed Targeting** ad-hoc dentro do `targeting_patch` do adset. Audiencias **reusaveis e qualificadas** — Custom Audiences (lista de clientes, pixel events, app events) e Lookalikes (semelhantes) — sao a base de toda otimizacao seria de Meta Ads. Esta spec adiciona o ciclo completo de gestao de audiencias: criar, listar, atualizar, deletar, anexar a adsets.

## Personas

- **Pedro** — "manda anuncio pra quem ja comprou no ultimo mes" no chat
- **Filipe** — quer subir lista CSV de leads, criar lookalike 1% e usar em adset novo
- **Agente IA** — propoe via FURY rule "criar lookalike toda quinta-feira a partir dos compradores ultimos 30d"

## Requisitos funcionais

### R1 — Sincronizar audiencias existentes do Meta

R1.1 The system SHALL prover Edge Function `meta-sync-audiences` que:
- Resolve `act_id` via tenant guard
- Faz GET `/act_{id}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,time_created,time_updated,description,rule,retention_days,lookalike_spec` paginando ate fim
- Upserta em `meta_audiences` (1 row por external_id, scoped por company_id)

R1.2 SHALL ser invocavel via cron (sync diario) e via UI (botao "Sincronizar audiencias agora").

R1.3 SHALL respeitar rate limits (delay 200ms entre paginas; retry exponencial em HTTP 429).

### R2 — Criar Custom Audience por upload de CSV

R2.1 The system SHALL prover tool `create_customer_list_audience` aceitando:
- `name: string` (obrigatorio)
- `description?: string`
- `customer_file_source: 'USER_PROVIDED_ONLY' | 'PARTNER_PROVIDED_ONLY' | 'BOTH_USER_AND_PARTNER_PROVIDED'`
- `subtype: 'CUSTOM'` (default)
- `payload: { schema: ('EMAIL'|'PHONE'|'FN'|'LN'|'GEN'|'DOBY'|'COUNTRY')[]; data: string[][] }` — CSV ja parseado e hashed SHA256 client-side antes de enviar

R2.2 The Edge Function `meta-audience-create` SHALL:
- Criar audiencia vazia via `POST /act_{id}/customaudiences`
- Adicionar usuarios em batches de 10000 via `POST /{audience_id}/users` com payload Meta-spec (lista de SHA256 normalizados)
- Atualizar `meta_audiences` local com status='processing' ate `delivery_status` virar `200/READY`

R2.3 SHALL passar por `withSafetyRails` (action_kind='create_audience', cost=0).

R2.4 SHALL hashear no CLIENT (browser) — server NUNCA recebe email/telefone em texto claro.

### R3 — Criar Lookalike Audience

R3.1 The system SHALL prover tool `create_lookalike_audience` aceitando:
- `name: string`
- `origin_audience_id: string` (uuid local de meta_audiences) ou `origin_audience_external_id`
- `lookalike_spec: { country: string; ratio: 0.01 | 0.02 | 0.05 | 0.10; type: 'similarity'|'reach'|'reach_and_similarity' }` (ratio = 1%/2%/5%/10%)

R3.2 Edge Function `meta-audience-lookalike` SHALL:
- Validar que origem tem `approximate_count_lower_bound >= 100` (Meta exige ≥100 pra LAL)
- Criar via `POST /act_{id}/customaudiences` com `subtype=LOOKALIKE` e `origin_audience_id` + `lookalike_spec` JSON
- Upserta em `meta_audiences` com `subtype='LOOKALIKE'`, `parent_audience_id=origem_local_uuid`

R3.3 SHALL passar por safety rails (action_kind='create_lookalike').

### R4 — Atualizar / Deletar audiencia

R4.1 Tool `update_audience` aceita: `audience_id`, `name?`, `description?`, `retention_days?`. Edge `meta-audience-update`.

R4.2 Tool `delete_audience` aceita: `audience_id`, `confirm: boolean=false`. Edge `meta-audience-delete` SHALL:
- Recusar com `requires_confirmation` se `confirm=false`
- Recusar se audiencia esta atualmente em uso por algum adset ATIVO (consultar `meta_audience_usage` view)
- Remover via `DELETE /{audience_external_id}` apenas com `confirm=true` E nao em uso

R4.3 SHALL passar por safety rails (delete=action critica).

### R5 — Anexar audiencia a adset

R5.1 The `update_adset` tool (Sprint 2) SHALL aceitar `targeting_patch.custom_audiences` e `targeting_patch.excluded_custom_audiences` — arrays de `{id: string}` (Meta external ids).

R5.2 Helper SHALL converter local audience uuids -> external_ids antes de mandar pro Meta.

R5.3 SHALL validar que cada audience referenciada pertence ao mesmo `company_id` (sem cross-tenant leak).

### R6 — UI: View "Audiencias"

R6.1 Nova view `AudiencesView` no sidebar com icone `Users`, listando todas `meta_audiences` da company.

R6.2 Cada row mostra: nome, subtype, tamanho aproximado (`{lower}-{upper}` ou "Pequena/Media/Grande"), status (READY/PROCESSING/EMPTY), origem (se LAL), retention.

R6.3 Botoes:
- "Sincronizar agora" (top-right) -> dispara meta-sync-audiences
- "Nova audiencia" (top-right primary) -> abre dialog com 3 abas: Custom (CSV upload), Pixel (rule builder), Lookalike (selecao de origem + ratio)
- Por row: "Editar nome", "Criar LAL desta", "Deletar"

R6.4 Drag-and-drop CSV no dialog Custom (parser cliente-side limita 1MB; mostra preview de 5 linhas).

### R7 — Tabela `meta_audiences` + view `meta_audience_usage`

R7.1 Migration `audience-management` cria tabela:
```
meta_audiences (
  id uuid pk default gen_random_uuid(),
  company_id uuid fk companies not null,
  external_id text unique not null,
  name text not null,
  description text,
  subtype text not null check (subtype in ('CUSTOM','LOOKALIKE','WEBSITE','APP','ENGAGEMENT')),
  parent_audience_id uuid fk meta_audiences,
  approximate_count_lower_bound bigint,
  approximate_count_upper_bound bigint,
  delivery_status jsonb,
  operation_status jsonb,
  retention_days int,
  lookalike_spec jsonb,
  rule jsonb,
  time_created timestamptz,
  time_updated timestamptz,
  local_created_at timestamptz default now(),
  local_updated_at timestamptz
);
```

R7.2 Migration cria view `meta_audience_usage` que cruza com `adsets.targeting->custom_audiences`:
- Lista cada audiencia + adsets que referenciam + status do adset
- Usada pra bloquear delete de audiencia em uso

R7.3 RLS policies: SELECT/INSERT/UPDATE/DELETE limitado a company_id do user (mesmo padrao das outras tabelas Meta).

### R8 — Telemetria

R8.1 Cada Edge Fn nova SHALL logar `agent_runs` + ledger via withSafetyRails.

R8.2 `meta-sync-audiences` SHALL emitir metric `audiences_synced_total` por sync run.

## Out of scope

- Engagement Custom Audiences (Sprint 4)
- Pixel Custom Audiences via rule builder dinamico (Sprint 4 — exige UI complexo)
- Catalog Custom Audiences (Sprint 6 — depende de catalog-management)
- Cross-account audience sharing (Sprint 8 — agency-mode)

## Criterios de aceite

- [ ] `meta_audiences` table + RLS + `meta_audience_usage` view aplicadas
- [ ] 5 Edge Fns: meta-sync-audiences, meta-audience-create, meta-audience-lookalike, meta-audience-update, meta-audience-delete
- [ ] 4 tools registradas no chat: create_customer_list_audience, create_lookalike_audience, update_audience, delete_audience
- [ ] update_adset (Sprint 2) aceita custom_audiences/excluded em targeting_patch e converte uuid -> external_id
- [ ] AudiencesView renderiza lista + dialog de criacao + delete protegido
- [ ] Hash SHA256 de PII feito client-side (verificavel no Network tab)
- [ ] Build verde + Captain valida + Hulk valida
