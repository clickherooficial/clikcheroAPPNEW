# Requirements — agent-execution-loop

> Sprint 5/8. Fast-track overnight.

## Visao

Hoje `propose_plan` (data-fetchers) cria `plans` + N `approvals` filhas, e o usuario aprova
cada step individualmente via `approval-action` Edge Fn. Falta:
1. Executor SEQUENCIAL com batch approval — usuario aprova plan inteiro de uma vez
2. Tracking de progresso (executed_steps_count, failed_at_step)
3. Captura de ledger_ids[] de cada step pra ROLLBACK futuro
4. Suporte ao novo set de tools (update_campaign, update_adset, shift_budget, change_schedule, audiencias) em plan steps
5. UI dedicada de Plans com status real-time

## Personas

- **Pedro** — chat: "limpa a casa: pausa essas 3 mortas, aumenta budget das 2 vencedoras pra 100 cada, cria LAL daqueles compradores 30d"
- **Filipe** — quer ver o plano executando passo a passo, com botao de "abortar" se algo der errado
- **Agente IA** — propoe plano via FURY rule "diariamente: pausa cpl>30 + remaneja budget"

## Requisitos funcionais

### R1 — Extensao do schema

R1.1 Migration adiciona em `plans`:
- `executed_steps_count int NOT NULL DEFAULT 0`
- `failed_at_step int`
- `ledger_ids text[] NOT NULL DEFAULT '{}'` (capacita rollback futuro)
- `started_at timestamptz`
- expandir status check pra incluir 'running' e 'rolled_back'

R1.2 Migration estende action_type permitido em `approvals` pra cobrir novas tools (update_campaign, update_adset, update_ad, shift_budget, change_schedule, create_pixel_audience, etc) — pode ser TEXT sem CHECK ou CHECK estendido.

### R2 — Edge Function `agent-plan-execute`

R2.1 SHALL aceitar `{ plan_id: uuid }` no body.
R2.2 SHALL validar:
- Plan pertence ao company do user (tenant guard)
- Plan.status === 'approved' (so executa apos aprovacao do usuario)

R2.3 SHALL transitar plan.status: approved → running → (executed | partial | failed).

R2.4 Para cada approval filho em ordem (`plan_step_order ASC`):
- Mapear action_type pra Edge Fn correspondente
- POST com user JWT (preserva RLS) ou via supabaseAdmin se safety rails ja validou
- Capturar ledger_id da resposta
- Append em plan.ledger_ids[]
- Incrementar executed_steps_count
- Se step falhar: setar failed_at_step + status='failed' (ou 'partial' se >0 succeeded) e PARAR

R2.5 SHALL respeitar safety rails — se algum step retorna `blocked`, status vira 'partial' (nao 'failed') porque foi safety, nao bug.

R2.6 SHALL emitir evento realtime via supabase.from('plans') update — UI atualiza sem polling.

### R3 — Tool `execute_plan` no chat

R3.1 SHALL aceitar `plan_id`.
R3.2 SHALL chamar Edge Fn `agent-plan-execute`.
R3.3 SHALL retornar resumo legivel ao LLM (steps executed/N, ledger_ids count, status final).

### R4 — UI: View "Planos"

R4.1 Nova view `PlansView` no sidebar (icone `ListChecks`) listando `plans` da company:
- Cada plan: human_summary, status badge, progress bar (executed_steps_count / total)
- Click expand: lista de approvals filhos com status individual + ledger_id link

R4.2 Botao por plan (quando status='approved'): "Executar agora" -> dispara Edge Fn

R4.3 Botao "Abortar" quando status='running' — apenas marca plan.status='aborted' (futuro: rollback automatico)

### R5 — Out of scope (este sprint)

- Rollback automatico no fail (proxima iteracao — basta capturar ledger_ids agora)
- Pause/resume de plan em execucao (proxima)
- Plans agendados (cron) — ja temos infra mas nao expoe na UI (Sprint 8)

## Criterios de aceite

- [ ] Migration aplicada
- [ ] Edge Fn `agent-plan-execute` deployada
- [ ] Tool `execute_plan` no chat executando plan completo
- [ ] PlansView renderiza lista + status real-time + botao executar
- [ ] Build verde
