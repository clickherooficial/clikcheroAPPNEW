# Requirements — meta-edits-suite

> Sprint 2/8. Depende de `agent-safety-rails` (Sprint 1) — toda Edge Fn nova vai usar `withSafetyRails`.
> Status: requirements
> Idioma: pt-BR (formato EARS)

## Visao

Hoje o ClickHero **CRIA** campanha (campaign-publish) e **PAUSA/REATIVA** (action-manager + fury). Mas nao **EDITA** depois de criada. O agente de trafego completo precisa **otimizar** — mudar budget, ajustar targeting, mudar bid strategy, mudar schedule. Esta spec adiciona 6 capacidades de edicao expostas como tools no chat e no painel.

## Personas

- **Pedro** — "aumenta o budget da campanha que esta vendendo bem" no chat
- **Filipe** — quer painel granular pra editar bid strategy, schedule, targeting
- **Agente IA** — pode propor edits autonomos via FURY rules ou plans (com safety rails consultadas)

## Requisitos funcionais

### R1 — Tool `update_campaign` no chat

R1.1 The system SHALL provide a chat tool `update_campaign` que aceita:
- `campaign_id` (uuid local) ou `campaign_external_id` (Meta)
- `name?: string` (max 250 chars)
- `status?: 'ACTIVE' | 'PAUSED'`
- `daily_budget?: number` (BRL, multiplica por 100 pra centavos da Meta API)
- `lifetime_budget?: number`
- `bid_strategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'`
- `bid_amount?: number` (so se bid_strategy != LOWEST_COST_WITHOUT_CAP)
- `start_time?: ISO8601`, `stop_time?: ISO8601`

R1.2 The tool SHALL chamar Edge Function `meta-update-campaign` que:
- Resolve company_id via JWT
- Valida payload com Zod
- Estima cost_brl_estimate (delta budget * 30 dias)
- Chama withSafetyRails
- Se passou nos gates, faz POST `/{campaign_id}` na Graph API com fields atualizados
- Atualiza `campaigns` local com fields novos + `updated_at`

R1.3 Errors mapeados pra error_kinds (tipo campaign-publish): validation/safety_blocked/upstream/timeout/not_found/permission/unknown

### R2 — Tool `update_adset` no chat

R2.1 The system SHALL provide tool `update_adset` aceitando:
- `adset_id` ou `adset_external_id`
- `name?`, `status?: 'ACTIVE'|'PAUSED'`
- `daily_budget?`, `lifetime_budget?`
- `bid_amount?`, `bid_strategy?`
- `optimization_goal?: 'LINK_CLICKS' | 'OFFSITE_CONVERSIONS' | 'LANDING_PAGE_VIEWS' | 'POST_ENGAGEMENT' | 'REACH' | 'IMPRESSIONS'`
- `targeting?: jsonb` (objeto Targeting da Meta, validado parcialmente)
- `start_time?`, `end_time?`

R2.2 The Edge Function SHALL be `meta-update-adset` (mesma estrutura de update-campaign).

R2.3 Targeting changes SHALL preservar campos nao informados (read targeting atual + merge + write — evita resetar targeting parcial).

### R3 — Tool `update_ad`

R3.1 The system SHALL provide tool `update_ad` aceitando:
- `ad_id` ou `ad_external_id`
- `name?`, `status?`
- `creative?: { headline?, body?, description?, call_to_action_type?, link_url? }` — edita creative existente ou cria novo se substantivo

R3.2 Edge Fn `meta-update-ad`. Se mudar creative, SHALL ASSUMIR que cria-se um creative novo na Meta (best practice — Meta nao deixa editar creative ativo) e linka ao ad existente.

### R4 — Tool `shift_budget` (re-aloca entre adsets/campanhas)

R4.1 The system SHALL provide tool `shift_budget` aceitando:
- `from_id` (campaign_id ou adset_id)
- `to_id`
- `amount_brl: number`
- `level: 'campaign' | 'adset'`

R4.2 SHALL fazer 2 calls atomicas: decrease em from + increase em to. Se 2a falha, faz rollback do 1o.

R4.3 cost_brl_estimate = 0 (zero-sum), MAS triggera 2 entries no ledger (uma por direcao), e cada uma respeita seus proprios gates de spend velocity (decrease nao gateado por velocity, increase sim — mas e zero-sum dentro da company entao spend total nao muda).

### R5 — Tool `change_schedule`

R5.1 The system SHALL provide tool `change_schedule` aceitando:
- `target_id` + `target_kind: 'campaign'|'adset'`
- `start_time?`, `end_time?`
- `dayparting?: { hours_of_day: number[], days_of_week: number[] }` (formato ad_schedule da Meta)

R5.2 Dayparting requer billing event = IMPRESSIONS (Meta restriction). Edge Fn valida + erro claro se nao for o caso.

### R6 — Painel granular de edicao

R6.1 The system SHALL extend `CampaignPublisherView` ou criar nova view "Otimizacao" com:
- Lista de campaigns/adsets/ads sincronizadas
- Detalhe expand mostrando fields editaveis com inline edit
- Botao "Salvar mudanca" dispara o tool/Edge Fn correspondente
- Mostra preview do impacto: "voce esta aumentando budget de R$X pra R$Y (+30%) — isso vai consumir R$Z/30d"

R6.2 Cada inline edit SHALL preview safety check: se bloqueado por gate, mostra reason inline antes de submit.

R6.3 SHALL ter botao "Gerar plano de otimizacao" que vira `propose_plan` pre-preenchido com edits batch (Sprint 5 fechara o loop com agent-execution-loop).

### R7 — Validacao defensiva

R7.1 Toda edge fn SHALL validar com Zod:
- daily_budget min R$5 (Meta minimum pra account BR)
- lifetime_budget min R$50
- bid_amount > 0 quando bid_strategy != LOWEST_COST_WITHOUT_CAP
- targeting.geo_locations.countries DEFAULT ['BR'] se nao informado
- start_time < stop_time se ambos informados
- name length 1-250
- bid_strategy enum exato

R7.2 Pre-flight check: SHALL ler estado atual do recurso na Meta (GET) antes de PATCH, comparar com payload local, e cancelar se houver drift detectado (campaign foi pausada por outro processo entre nosso read e write). Excecao: action-manager pause/reactivate (force-write).

### R8 — Telemetria

R8.1 Cada Edge Fn nova SHALL logar em `agent_runs` (consistente com padroes existentes) + ledger (via withSafetyRails) + retornar latency_ms na response.

R8.2 Adicionar metric: % de edits que tiveram drift detectado (telemetria pra detectar concorrencia user/agent).

## Out of scope

- Custom audiences, lookalikes (Sprint 3)
- A/B testing API (Sprint 7)
- Catalog / DPA (Sprint 6)
- Multi-account batch edit (Sprint 8)

## Criterios de aceite

- [ ] 5 Edge Functions novas deployadas: meta-update-campaign, meta-update-adset, meta-update-ad, meta-shift-budget, meta-change-schedule
- [ ] 5 tools registradas em `_shared/tools.ts` e funcionais via chat
- [ ] Cada Edge Fn passa por safety rails (sandbox simula, real executa)
- [ ] Painel granular renderiza fields editaveis e dispara mutation
- [ ] Pre-flight drift check funciona (caso de teste: pausar via Meta direto + tentar editar)
- [ ] Build verde + Captain valida + Hulk valida
