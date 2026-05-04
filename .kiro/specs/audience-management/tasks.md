# Tasks — audience-management

> Sprint 3/8. Implementar APOS agent-safety-rails (Sprint 1) e meta-edits-suite (Sprint 2) deployados.

## 1. Backend (DB + helper)

- [x] 1.1 Criar migration `supabase/migrations/20260504000001_audience_management.sql` com tabela `meta_audiences`, view `meta_audience_usage`, RPC `audience_in_active_use`, RLS policies, indexes
- [x] 1.2 Criar helper `supabase/functions/_shared/audience-helpers.ts` com `fetchAudiencePages`, `uploadUsersInBatches`, `validateLookalikeOrigin`
- [ ] 1.3 Aplicar migration via Dashboard

## 2. Edge Functions (5 novas)

- [x] 2.1 `supabase/functions/meta-sync-audiences/index.ts` — paginar customaudiences + upsert local, idempotente, rate-limited
- [x] 2.2 `supabase/functions/meta-audience-create/index.ts` — POST customaudience + upload em batches de 10k + safety rails wrap
- [x] 2.3 `supabase/functions/meta-audience-lookalike/index.ts` — valida count >= 100, cria LAL, link parent_audience_id local
- [x] 2.4 `supabase/functions/meta-audience-update/index.ts` — name/description/retention_days
- [x] 2.5 `supabase/functions/meta-audience-delete/index.ts` — bloqueia se in_active_use, exige confirm=true
- [ ] 2.6 Deploy 5 Edge Fns via CLI (manual)
- [ ] 2.7 Smoke: criar audiencia teste de 5 linhas, listar, criar LAL 1% Brasil, deletar — confirmar ledger entries

## 3. Tools no chat

- [x] 3.1 Adicionar 4 tools em `_shared/tools.ts` (CHAT_TOOLS): `create_customer_list_audience`, `create_lookalike_audience`, `update_audience`, `delete_audience`
- [x] 3.2 Criar `_shared/audience-tool-handlers.ts` com 4 executors (HTTP fetch para Edge Fns com user JWT)
- [x] 3.3 Adicionar 4 cases em `ai-chat/index.ts` `executeTool`
- [x] 3.4 Atualizar SYSTEM_PROMPT em `_shared/prompt.ts` — secao "AUDIENCIAS" instruindo:
  - quando criar Custom (lista de clientes existente) vs Lookalike (expandir)
  - exemplos negativos: nao usar update_audience pra trocar lista de pessoas
  - lembrar: PII vai SHA256 ja do frontend

## 4. Integracao com Sprint 2 (update_adset)

- [x] 4.1 Estender `meta-update-adset` Edge Fn pra aceitar `targeting_patch.custom_audiences: [{id_or_uuid: string}]` e `excluded_custom_audiences`
- [x] 4.2 Adicionar resolver: se item tem formato uuid, lookup em meta_audiences -> trocar por `{id: external_id}`; se ja for external_id (numerico ou Meta-format) passar direto
- [x] 4.3 Validar que cada audiencia pertence ao company_id do request (anti cross-tenant)

## 5. Tipos compartilhados

- [x] 5.1 Criar `src/types/audiences.ts` com `MetaAudience`, `AudienceSubtype`, 4 payload types

## 6. Hash SHA256 client-side

- [x] 6.1 Criar `src/lib/sha256.ts` com `sha256Hex(input)` e `hashRow(schema, raw)` — normaliza (lowercase, trim) antes
- [x] 6.2 Test unit: `src/test/sha256.test.ts` com 5 fixtures (email, phone formato Meta E164, FN, etc) — verificar hash bate com fixture pre-calculada

## 7. Hooks React

- [x] 7.1 Criar `src/hooks/use-audiences.ts` com `useAudiences`, `useSyncAudiences`, `useCreateCustomerListAudience`, `useCreateLookalike`, `useUpdateAudience`, `useDeleteAudience`

## 8. UI — View Audiencias

- [x] 8.1 Criar `src/components/audiences/CSVDropzone.tsx` — drag-and-drop, parser CSV cliente-side, preview 5 linhas, limite 1MB
- [x] 8.2 Criar `src/components/audiences/AudienceListRow.tsx` — row da tabela
- [x] 8.3 Criar `src/components/audiences/LookalikePicker.tsx` — origem + ratio slider (1/2/5/10) + country select
- [x] 8.4 Criar `src/components/audiences/DeleteAudienceConfirm.tsx` — AlertDialog que mostra adsets em uso antes de permitir
- [x] 8.5 Criar `src/components/audiences/CreateAudienceDialog.tsx` — Tabs: Custom / Pixel (placeholder) / Lookalike
- [x] 8.6 Criar `src/components/AudiencesView.tsx` — composer
- [x] 8.7 Adicionar "Audiências" em `AppSidebar.tsx` com icone `Users` (lucide-react)
- [x] 8.8 Wire em `src/pages/Index.tsx`: View union, viewTitles, VALID_VIEWS, switch render

## 9. Validacao + tests

- [x] 9.1 Test unit: `src/test/audiences/sha256.test.ts` (item 6.2)
- [ ] 9.2 Test unit: `src/test/audiences/payload-validation.test.ts` — Zod schemas das 4 tools rejeitam payloads invalidos (Edge Fn Zod e Deno-only — pendente)
- [ ] 9.3 SQL test: `meta_audience_usage` retorna shape correto + `audience_in_active_use` true/false em fixtures
- [ ] 9.4 E2E manual:
  - upload CSV de 5 linhas (com PII fake), criar Custom Audience, ver no painel
  - tentar deletar -> bloqueia se anexada a adset ativo
  - criar LAL 1% Brasil a partir da Custom acima
  - usar create_customer_list_audience via chat — confirmar PII nao aparece em network logs server-side

## 10. Steering update

- [x] 10.1 Atualizar `.kiro/steering/implemented-features.md` com secao "audience-management (data)" listando tabelas, view, RPC, 5 Edge Fns, 4 tools, view UI, decisoes (PII client-side, parent_audience_id pra lineage, view vs junction)

## 11. Captain America Review

- [ ] 11.1 Captain valida: RLS habilitada em meta_audiences, SELECT por company_id correto, INSERT/UPDATE checa via WITH CHECK, parent_audience_id ON DELETE SET NULL nao orfaniza inadequadamente
- [ ] 11.2 Captain valida: PII nunca tocada server-side (grep por 'EMAIL\|email' nos logs do server)
- [ ] 11.3 Captain valida: delete bloqueia cross-tenant (testar manualmente: company A nao consegue deletar audiencia de company B)

## 12. Hulk Final

- [x] 12.1 `npm run build` verde
- [ ] 12.2 Lint: `npm run lint` sem erros novos
- [ ] 12.3 Smoke completo: sync de audiencias existentes (deve trazer N>=0), criar Custom 5 linhas, criar LAL, deletar
- [x] 12.4 Resumo final ao usuario com links clicaveis

---

## Status

- Fase: requirements -> aguardando approval
- Bloqueado por: agent-safety-rails (Sprint 1) e meta-edits-suite (Sprint 2) deployados
- Bloqueia: predictive-engine (Sprint 7) — recomendacoes de audiencia precisam do catalog disponivel
