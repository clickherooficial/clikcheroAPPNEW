# Tasks — meta-edits-suite

> Sprint 2/8. Implementar APOS agent-safety-rails (Sprint 1) estar deployado.

## 1. Backend (DB + helpers)

- [x] 1.1 Criar migration `supabase/migrations/20260503000002_meta_edits_columns.sql` com `local_updated_at` em campaigns/adsets, view `v_editable_campaigns`, RPC `estimate_budget_change_impact`
- [x] 1.2 Criar helper `supabase/functions/_shared/meta-edits-helpers.ts` com `resolveMetaContext`, `metaPatch`, `metaGet`, `preflightDriftCheck`, `MetaApiError` class
- [ ] 1.3 Aplicar migration via Dashboard

## 2. Edge Functions (5 novas)

- [x] 2.1 `supabase/functions/meta-update-campaign/index.ts` — implementacao completa com Zod + safety rails wrap
- [x] 2.2 `supabase/functions/meta-update-adset/index.ts` — idem com merge de targeting
- [x] 2.3 `supabase/functions/meta-update-ad/index.ts` — idem com creative replace logic
- [x] 2.4 `supabase/functions/meta-shift-budget/index.ts` — 2 calls atomicas + rollback
- [x] 2.5 `supabase/functions/meta-change-schedule/index.ts` — schedule + dayparting validation
- [ ] 2.6 Deploy 5 Edge Fns via CLI (manual)

## 3. Tools no chat

- [x] 3.1 Adicionar 5 tools em `_shared/tools.ts` (CHAT_TOOLS) — JSON schemas exatos
- [x] 3.2 Criar `_shared/edits-tool-handlers.ts` — `executeUpdateCampaign`, `executeUpdateAdset`, `executeUpdateAd`, `executeShiftBudget`, `executeChangeSchedule` (cada uma faz fetch HTTP pra Edge Fn correspondente com user JWT)
- [x] 3.3 Atualizar `ai-chat/index.ts` `executeTool` switch — 5 cases novos despachando pros handlers
- [x] 3.4 Atualizar SYSTEM_PROMPT em `_shared/prompt.ts` — secao "OTIMIZACAO DE CAMPANHA" instruindo quando usar cada tool, exemplos negativos (nao usar update_campaign pra criar)

## 4. Tipos

- [x] 4.1 Criar `src/types/meta-edits.ts` com `BidStrategy`, `AdsetOptimizationGoal`, 5 payload types, `MetaEditError` discriminated union

## 5. Hooks

- [x] 5.1 Criar `src/hooks/use-meta-edits.ts` com 5 mutations + invalidations

## 6. UI — View Otimizacao

- [x] 6.1 Criar `src/components/optimization/CampaignEditPanel.tsx` — 4 sub-secoes editaveis com inline-edit
- [x] 6.2 Criar `src/components/optimization/AdsetEditPanel.tsx`
- [x] 6.3 Criar `src/components/optimization/AdEditPanel.tsx`
- [x] 6.4 Criar `src/components/optimization/BudgetShiftDialog.tsx` — dialog pra mover budget entre 2 entidades
- [x] 6.5 Criar `src/components/optimization/ImpactPreviewBadge.tsx` — mostra delta% + 30d projection consultando `estimate_budget_change_impact`
- [x] 6.6 Criar `src/components/OptimizationView.tsx` que compoe lista + panels
- [x] 6.7 Adicionar "Otimizacao" no AppSidebar com icone `Sliders` (lucide-react)

## 7. Validacao + tests

- [ ] 7.1 Test unit: `src/test/meta-edits/payloads.test.ts` — Zod schemas validam corretamente
- [ ] 7.2 SQL test: cenario de drift detection em `.kiro/specs/meta-edits-suite/tests/sql.sql`
- [ ] 7.3 E2E manual: editar 1 campaign budget no painel, ver mutation -> ledger -> meta-sync confirma

## 8. Steering update

- [ ] 8.1 Atualizar `.kiro/steering/implemented-features.md` com secao "meta-edits-suite (data)" listando 5 Edge Fns + tools + view + decisoes

## 9. Captain America

- [ ] 9.1 Captain valida: Zod refines, pre-flight drift, RLS preservada (Edge Fns usam user JWT), tokens decryptados em memoria so dentro da Edge Fn (nao logam)

## 10. Hulk

- [ ] 10.1 Build verde, lint, smoke (3 cenarios: edit budget user / shift between adsets / drift detection)

---

## Status

- Fase: requirements -> aguardando approval
- Bloqueado por: agent-safety-rails (Sprint 1) precisa estar deployado primeiro
