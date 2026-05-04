# Tasks — agent-safety-rails

> Tasks atomicas, marcar [x] conforme concluido. Cada bloco numerado e independente; ordem dentro do bloco importa.

## 1. Backend (DB + Edge helper)

- [x] 1.1 Criar migration `supabase/migrations/20260503000001_agent_safety_rails.sql` com tabela `agent_safety_config`, `agent_action_ledger`, RPCs `check_safety_gates`/`log_agent_action`/`get_safety_status`, trigger circuit breaker, RLS policies, backfill de companies existentes
- [x] 1.2 Criar helper `supabase/functions/_shared/safety-rails.ts` com `checkSafetyGates`, `logAgentAction`, `withSafetyRails`
- [ ] 1.3 Aplicar migration via Supabase Dashboard (manual — Hulk valida)
- [ ] 1.4 Smoke SQL: confirmar 1 row em `agent_safety_config` por company existente, RLS ativa, `SELECT check_safety_gates(...)` retorna jsonb valido

## 2. Wrap Edge Functions criticas

- [x] 2.1 Wrap `campaign-publish/index.ts` com `withSafetyRails` (action_kind='publish_campaign', cost = daily_budget * 30)
- [x] 2.2 Wrap `action-manager/index.ts` (action_kind dinamico: 'pause_campaign'|'reactivate_campaign'|'update_budget_up'|'update_budget_down')
- [x] 2.3 Wrap `fury-evaluate/index.ts` (action_kind='auto_pause_fury', triggered_by='rule', triggered_by_id=rule.id, cost=campaign_daily_budget como evitado)
- [x] 2.4 Wrap `compliance-scan/index.ts` no handler de auto-takedown (action_kind='auto_takedown_compliance', triggered_by='rule')
- [ ] 2.5 Deploy 4 Edge Functions (manual — Hulk valida)
- [ ] 2.6 Smoke: ativar sandbox, disparar pause_campaign, confirmar ledger.status='simulated' e Meta API NAO chamada

## 3. Tipos compartilhados

- [x] 3.1 Criar `src/types/safety.ts` com SafetyConfig, SafetyStatus, LedgerStatus, BlockReason, ActionLedgerRow

## 4. Hooks React

- [x] 4.1 Criar `src/hooks/use-safety.ts` com `useSafetyStatus`, `useUpdateSafetyConfig`, `useResetCircuitBreaker`, `useActionLedger`

## 5. UI — View Seguranca do Agente

- [x] 5.1 Criar `src/components/safety/SafetyStatusCards.tsx` (4 cards top: Auto-execute / Sandbox / Acoes 1h/24h / Status pause)
- [x] 5.2 Criar `src/components/safety/SafetyConfigForm.tsx` (toggles + sliders + form com mutation)
- [x] 5.3 Criar `src/components/safety/ActionLedgerTable.tsx` (tabela paginada com filtros status/agent_name/triggered_by)
- [x] 5.4 Criar `src/components/safety/CircuitBreakerBanner.tsx` (alerta destacado quando paused, botao reset)
- [x] 5.5 Criar `src/components/SafetyView.tsx` que compoe os 4 acima
- [x] 5.6 Adicionar "Seguranca" na View union em `src/components/AppSidebar.tsx` com icone `Shield` (lucide-react)
- [x] 5.7 Conectar SafetyView no `src/pages/Index.tsx` no switch de views

## 6. Indicador global no AppSidebar

- [x] 6.1 No `AppSidebar.tsx`, adicionar dot vermelho discreto no item "Seguranca" quando `useSafetyStatus().is_paused === true`

## 7. Validacao e tests

- [ ] 7.1 Test unit: `src/test/safety/safety-config.test.ts` — valida defaults, CHECK constraints (limites min/max)
- [ ] 7.2 Test unit: helper `withSafetyRails` mocado — sandbox path / blocked path / executed path
- [ ] 7.3 SQL test: cenarios em `.kiro/specs/agent-safety-rails/tests/sql-integration.sql` — rate limit dispara, breaker dispara apos 3 fails, get_safety_status retorna shape correto
- [ ] 7.4 E2E manual (Pedro path): ligar/desligar sandbox, executar 11 pause em 1h, ver bloqueio na 11a

## 8. Documentacao e steering

- [x] 8.1 Atualizar `.kiro/steering/implemented-features.md` com secao "agent-safety-rails (2026-05-03)" listando tabelas, RPCs, Edge helpers, hooks, componentes
- [x] 8.2 Atualizar `.kiro/steering/tech.md` se algum detalhe arquitetural novo (helper compartilhado)

## 9. Captain America Review

- [ ] 9.1 Captain valida: RLS habilitada nas 2 tabelas, INSERT bloqueado pra usuarios em config (so trigger), DELETE bloqueado em ledger, SECURITY DEFINER nos RPCs com checagem de tenant, no `USING(true)` perigoso
- [ ] 9.2 Captain valida: helper nao expoe service-role pra cliente, withSafetyRails nao loga payloads sensiveis (tokens, emails)

## 10. Hulk Final

- [ ] 10.1 `npm run build` verde
- [ ] 10.2 Tipos: `npm run lint` sem erros novos
- [ ] 10.3 Smoke completo (3 cenarios): user dispara pause em sandbox / user dispara em modo real / circuit breaker dispara
- [ ] 10.4 Resumo final ao usuario com links clicaveis

---

## Status

- Fase: implementing
- Ultima atualizacao: 2026-05-03
- Bloqueia: meta-edits-suite (Sprint 2) — exige safety rails wrap
