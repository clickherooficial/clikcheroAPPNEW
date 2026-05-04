# Requirements — agent-safety-rails

> Sprint 1/8 do roadmap "agente de trafego completo".
> Pre-requisito de TODAS as proximas sprints que liberam acoes autonomas (meta-edits-suite, agent-execution-loop, predictive-engine).
> Status: requirements
> Idioma: pt-BR (formato EARS)

## Visao geral

Quando o ClickHero comeca a executar acoes que mexem em dinheiro de cliente (mudar budget, pausar campanha, criar audience com dados pessoais hashed, etc.), precisamos de **trilhos de seguranca** que impecam o agente de causar dano por bug, alucinacao ou cascata de erros. Hoje a unica protecao e o HITL approvals + revert manual de FURY (30min). Isso nao escala.

Esta spec entrega 6 mecanismos de protecao que **toda Edge Function de execucao** deve consultar antes de agir, e uma **superficie de configuracao** pra cada company definir seus limites.

## Personas

- **Pedro (cliente leigo, dono de padaria)** — quer que o agente "rode no automatico" mas nao confia ainda. Precisa de modo simulacao + alertas claros quando algo passa do limite.
- **Filipe (gestor de trafego experiente)** — quer auto-mode mais agressivo mas com circuit breaker que pare tudo se algo der errado.
- **Agente IA (orchestrator do ai-chat)** — antes de invocar action-manager/campaign-publish/compliance-scan/fury-evaluate auto-execute, precisa consultar safety state e abortar se nao autorizado.

## Requisitos funcionais (formato EARS)

### R1 — Tabela de configuracao de seguranca por company

R1.1 The system SHALL provide uma tabela `agent_safety_config` com 1 linha por `company_id` (UNIQUE), criada automaticamente via trigger ao inserir nova company com defaults conservadores.

R1.2 The table SHALL contain at minimum:
- `auto_execute_enabled boolean DEFAULT false` — gate global
- `sandbox_mode boolean DEFAULT true` — quando true, todas as acoes rodam dry-run e sao logadas mas nao chamam Meta API
- `max_actions_per_hour int DEFAULT 10` — hardcap de execucoes/hora por company (todas as Edge Fns somadas)
- `max_actions_per_day int DEFAULT 50`
- `max_spend_increase_pct_per_day int DEFAULT 30` — limite cumulativo de aumento de orcamento agregado em 24h
- `max_spend_decrease_pct_per_day int DEFAULT 100` — diminuir/pausar e mais permissivo (default 100% = pode pausar tudo)
- `circuit_breaker_threshold int DEFAULT 3` — N falhas consecutivas que disparam o breaker
- `circuit_breaker_cooldown_minutes int DEFAULT 60`
- `require_approval_above_brl numeric DEFAULT 100` — qualquer acao que afete budget acima desse valor exige HITL approval, mesmo se auto_execute_enabled=true
- `paused_until timestamptz NULL` — pause global temporario (manual ou via breaker)
- `paused_reason text NULL`
- `created_at, updated_at timestamptz`

R1.3 The table SHALL have RLS enabled with: SELECT/UPDATE permitido a usuarios da company; INSERT bloqueado pra usuarios (so trigger ou service-role); DELETE bloqueado.

### R2 — Action Ledger (registro imutavel de toda acao executada)

R2.1 The system SHALL provide uma tabela `agent_action_ledger` (append-only) que registra TODA acao executada por qualquer Edge Function, com:
- `id uuid PK`
- `company_id uuid NOT NULL` (FK)
- `agent_name text NOT NULL` (ex: 'campaign-publish', 'action-manager', 'fury-evaluate')
- `action_kind text NOT NULL` (ex: 'pause_campaign', 'update_budget', 'publish_campaign')
- `target_kind text` (ex: 'campaign', 'adset', 'ad'), `target_external_id text`
- `payload_jsonb jsonb` (snapshot do request)
- `result_jsonb jsonb` (snapshot do response)
- `status text CHECK IN ('simulated','succeeded','failed','blocked','rolled_back')`
- `block_reason text NULL` (preenche se status=blocked: 'rate_limit'|'circuit_breaker'|'spend_velocity'|'sandbox_mode'|'paused'|'requires_approval')
- `latency_ms int`
- `cost_brl_estimate numeric(10,2) NULL` — estimativa do impacto financeiro em 24h da acao
- `triggered_by text` — 'user'|'agent'|'cron'|'rule'|'plan'
- `triggered_by_id uuid NULL` (user_id, plan_id, rule_id...)
- `executed_at timestamptz DEFAULT now()`
- `idempotency_key text UNIQUE NULL`

R2.2 The ledger SHALL be append-only: UPDATE/DELETE bloqueados via RLS (somente INSERT por service-role + SELECT por tenant).

R2.3 RPC `log_agent_action(...)` SECURITY DEFINER deve ser exposto pra Edge Functions chamarem com service-role.

### R3 — Sandbox Mode (dry-run)

R3.1 When `sandbox_mode=true` for a company, every Edge Function that calls Meta API or modifies external state SHALL:
- Validar payload normalmente
- Calcular o impacto estimado (cost_brl_estimate)
- Inserir no ledger com `status='simulated'`
- Retornar response como se tivesse executado, com flag `simulated: true` no body
- NAO chamar a Meta API

R3.2 Sandbox mode SHALL be toggle-able from the UI by user with role admin/owner.

R3.3 The system SHALL ship with sandbox_mode=true por default — usuario precisa explicitamente desligar antes de qualquer execucao real.

### R4 — Rate Limiting (max_actions_per_hour/day)

R4.1 Before executing any action, Edge Function SHALL call RPC `check_safety_gates(company_id, agent_name, action_kind, cost_brl_estimate)` que retorna `{ allowed: boolean, block_reason?: string, remaining_quota?: object }`.

R4.2 The RPC SHALL count rows in agent_action_ledger nas ultimas 1h e 24h pra company, e retornar block_reason='rate_limit' se exceder thresholds da config.

R4.3 The Edge Function SHALL log no ledger com status='blocked' + block_reason='rate_limit' antes de retornar 429 ao caller.

### R5 — Spend Velocity Limit

R5.1 Before any action that increases budget (`update_budget`, `publish_campaign` com daily_budget>0), Edge Function SHALL calcular o aumento cumulativo nas ultimas 24h:
```
sum(cost_brl_estimate) WHERE company_id=X AND status IN ('succeeded','simulated') AND action_kind IN ('update_budget_up','publish_campaign') AND executed_at > now() - interval '24h'
```

R5.2 If `(cumulative_increase + new_action_cost) / yesterday_total_spend > max_spend_increase_pct_per_day`, return block_reason='spend_velocity' + log no ledger.

R5.3 Decrease/pause actions sao governadas por max_spend_decrease_pct_per_day (default 100%, ou seja, sem limite — pausar emergencia sempre passa).

### R6 — Circuit Breaker

R6.1 The system SHALL track consecutive failures por company via window function: ultimas N=`circuit_breaker_threshold` linhas em agent_action_ledger; se todas tiverem status='failed', breaker dispara.

R6.2 When breaker trips, RPC `trip_circuit_breaker(company_id, reason)` SHALL set `agent_safety_config.paused_until = now() + circuit_breaker_cooldown_minutes` e `paused_reason='circuit_breaker: <agent_name>'`.

R6.3 While paused (paused_until > now()), all actions are blocked com block_reason='paused'.

R6.4 User SHALL be able to manually reset via UI button "Resetar circuit breaker" (UPDATE paused_until=null).

### R7 — Approval threshold (require_approval_above_brl)

R7.1 Quando uma acao tiver `cost_brl_estimate > require_approval_above_brl`, Edge Function SHALL forcar criacao de approval pendente (mesmo se auto_execute_enabled=true) com status='blocked' + block_reason='requires_approval' no ledger.

R7.2 A Edge Function `approval-action` (existente) SHALL re-executar a acao quando approval for aprovado, marcando ledger entry com `triggered_by='user'` e linkando via `triggered_by_id=approval.id`.

### R8 — Frontend de configuracao

R8.1 The system SHALL provide a view "Seguranca do Agente" (nova tab no AppSidebar com icone Shield) com:
- Toggle Sandbox Mode com warning destacado
- Toggle Auto-Execute (gated atras de "li e entendi que o agente pode mexer em dinheiro real")
- Sliders: max_actions/h, max_actions/day, max_spend_increase_pct, require_approval_above_brl
- Card "Status atual": acoes nas ultimas 1h/24h, paused_until se aplicavel, breaker tripped indicator
- Tabela "Ledger recente" (ultimas 50 acoes) com filtros por status

R8.2 BadgeStatus visivel no AppSidebar quando paused_until > now() (sinal vermelho discreto).

### R9 — Integracao com Edge Functions existentes

R9.1 As seguintes Edge Functions DEVEM consultar safety gates antes de executar acao externa:
- `campaign-publish` (publica campanha — gasto novo)
- `action-manager` (executa pause/reactivate/update_budget — vai virar tool no chat)
- `fury-evaluate` (auto-pause de FURY)
- `compliance-scan` (auto-takedown — pausa anuncio)
- `apply-creative-pipeline` (modifica creative; baixo risco mas registra no ledger)
- `creative-generate`, `creative-iterate` (custo de IA — registra mas com cost_brl_estimate=cost_usd*5.5)
- futuras: `meta-update-campaign`, `meta-update-adset` (Sprint 2)

R9.2 Edge Functions atuais que NAO mexem em estado externo (read-only: meta-list-assets, meta-deep-scan read, kb-ingest, ai-chat sem tool_call, etc.) NAO precisam consultar gates.

### R10 — Observabilidade

R10.1 The system SHALL provide RPC `get_safety_status(company_id)` returning:
- current `agent_safety_config`
- `actions_last_1h`, `actions_last_24h`
- `cumulative_spend_increase_pct_24h`
- `recent_failures_count`
- `is_paused`, `paused_until`, `paused_reason`
- `top_block_reasons_7d` (jsonb with counts)

R10.2 The system SHALL expose RPC publica `get_safety_health()` que retorna agregado anonimizado (todas companies) para dashboard interno: total acoes/dia, % blocked, top block_reasons. Nao expoe company_id.

## Requisitos nao-funcionais

- **Performance**: `check_safety_gates` deve responder < 50ms p95 (consulta ledger com index em company_id+executed_at).
- **Concorrencia**: Uso de `SELECT ... FOR UPDATE` na agent_safety_config quando atualiza paused_until, pra evitar race em circuit breaker.
- **Auditoria**: Ledger imutavel — a unica forma de "corrigir" e inserir nova linha com `status='rolled_back'` referenciando a anterior.
- **Backwards compat**: Edge Functions existentes que nao chamarem ainda check_safety_gates continuam funcionando — os gates sao opt-in por enquanto. A Sprint 2 vai exigir gates pra todas as new edits.

## Out of scope

- Forecasting do impacto pos-acao (Sprint 7 — predictive-engine)
- Multi-step rollback (Sprint 5 — agent-execution-loop)
- Webhook OUT pra alertas externos (Sprint 8 — agency-mode)
- ML-based anomaly detection (futuro)

## Criterios de aceite

- [ ] Toda Edge Function listada em R9.1 chama `check_safety_gates` antes de executar acao externa
- [ ] Sandbox mode default ON pra novas companies
- [ ] User consegue desligar sandbox via UI e ver alerta de confirmacao
- [ ] Ledger registra 100% das acoes executadas (sample 50 acoes em staging)
- [ ] Circuit breaker dispara apos 3 falhas seguidas e libera apos cooldown
- [ ] Spend velocity bloqueia acao que excede 30%/24h (caso de teste com fixture)
- [ ] View "Seguranca do Agente" renderiza com 4 estados: ok / paused / breaker_tripped / sandbox_only
- [ ] Build verde + Hulk valida funcional
