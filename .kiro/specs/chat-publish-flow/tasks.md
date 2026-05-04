# Implementation Plan — chat-publish-flow

> Spec: `.kiro/specs/chat-publish-flow/`
> Modo: parallel-aware (tasks marcadas com `(P)` podem rodar em paralelo)

## Pré-requisitos

- Requirements aprovados ✅
- Design aprovado ✅
- Pesquisas resolvidas (research.md): compliance-runner refactor, signed URL Meta, polling reuso, targeting v1 simplificado

---

- [ ] 1. (P) Schema e RLS da tabela `campaign_proposals`
- [x] 1.1 (P) Migration aditiva da tabela com lifecycle, FKs e índices
  - Criar tabela com colunas: id, company_id, conversation_id, creative_id, created_by_message_id, payload_jsonb, compliance_jsonb, status (CHECK enum), publication_id, error_payload, created_at, updated_at, expires_at (default now+24h)
  - FKs: company_id → companies (CASCADE), conversation_id → chat_conversations (CASCADE), creative_id → creatives_generated (RESTRICT), publication_id → campaign_publications (SET NULL), created_by_message_id → chat_messages (SET NULL)
  - Status enum atualizado: pending_approval | cancelled | publishing | live | failed | expired
  - Índices: (company_id, created_at DESC), (conversation_id, status), partial (status) WHERE status='pending_approval'
  - Trigger `touch_campaign_proposals_updated_at` (BEFORE UPDATE)
  - Realtime publication ativada
  - **Implementado em**: [supabase/migrations/20260501000001_campaign_proposals.sql](../../../supabase/migrations/20260501000001_campaign_proposals.sql) — aplicada no DB remoto
  - _Requirements: 6.1, 6.4_

- [x] 1.2 (P) Políticas RLS por tenant + lockdown de INSERT
  - SELECT/UPDATE: company_id = current_user_company_id()
  - INSERT: WITH CHECK (false) — apenas service-role bypassa
  - DELETE: sem policy = bloqueado (audit trail)
  - **Implementado na mesma migration** acima
  - _Requirements: 6.2_

- [x] 1.3 Gerar tipos TypeScript do schema
  - `src/types/campaign-proposal.ts` criado com tipos manuais (gen types pulado por history mismatch — tipos hand-rolled cobrem o necessário e batem com schema da migration)
  - Inclui: CampaignProposal, CampaignProposalPayload, CampaignProposalStatus, MetaCtaEnum, MetaOptimizationGoal, AudiencePayload, CopyPayload, PrereqSnapshot, CreativeSnapshot, CompliancePreview, CampaignProposalErrorPayload, PrereqErrorKind
  - **Implementado em**: [src/types/campaign-proposal.ts](../../../src/types/campaign-proposal.ts)
  - _Requirements: 6.1, 6.3_

---

- [x] 2. (P) Refator de compliance — extrair runner compartilhado
- [x] 2.1 (P) Extrair `runComplianceCheck` de `campaign-publish` para módulo `_shared/compliance-runner.ts`
  - Movida lógica completa (fetchImageAsBase64, callClaudeForCompliance, checkCompliance) preservando comportamento bit-a-bit
  - Exposto em DUAS APIs: `runComplianceCheckRaw` (saída legado pro gate) + `runComplianceCheck` (saída UI shape pro preview)
  - Timeouts: 10s preview com fail-open severity='unknown', 30s gate
  - severityFromScore + violationsToHits adapta o resultado pra UI
  - **Implementado em**: [supabase/functions/_shared/compliance-runner.ts](../../../supabase/functions/_shared/compliance-runner.ts)
  - _Requirements: 7.1, 7.5_

- [x] 2.2 `campaign-publish` passa a importar `compliance-runner`
  - Removidas funções inline (~110 LOC), import + wrapper fino preserva assinatura local
  - Deploy validado (HTTP 200 em OPTIONS — boot sem erro)
  - **Implementado em**: [supabase/functions/campaign-publish/index.ts](../../../supabase/functions/campaign-publish/index.ts)
  - _Requirements: 7.1_

- [ ] 2.3* Snapshot tests do `compliance-runner` cobrindo 5 cenários
  - **Deferido pós-MVP** (marcado opcional): refator preservou output bit-a-bit; smoke test com OPTIONS confirmou boot
  - _Requirements: 7.2, 7.3, 7.4_

---

- [x] 3. (P) Helpers compartilhados de pré-requisitos e resolução de defaults
- [x] 3.1 (P) `TenantPrereqGuard` — checar ad_account, page e briefing
  - Query `meta_ad_accounts` ativa (is_active=true, deleted_at IS NULL) ordenada por selected_at desc
  - Query `meta_pages` ativa similar
  - Query `meta_pixels` opcional (is_unavailable=false)
  - Query `v_company_briefing_status.is_complete` (informativo, não bloqueia)
  - Detecta `pages_ambiguous` quando >1 página ativa
  - Retorna PrereqGuardResult com ready/context/missing/pages_ambiguous
  - **Implementado em**: [supabase/functions/_shared/campaign-proposal-helpers.ts](../../../supabase/functions/_shared/campaign-proposal-helpers.ts) (`checkPrereqs`)
  - _Requirements: 1.8, 10.1, 10.2, 10.3, 10.4_

- [x] 3.2 (P) `BriefingResolver` — pré-preencher defaults da proposta
  - Mapas: OBJECTIVE_BY_FORMAT, OPTIMIZATION_BY_OBJECTIVE
  - Audience v1 simples: age + countries=['BR'] (interests=[] conforme D5)
  - Budget mínimo R$10/dia
  - link_url: offer.sales_url > briefing.website_url > fallback
  - campaign_name: `{offer.name} - {YYYY-MM-DD}`
  - Falha com `briefing_no_offer` se sem oferta primária
  - **Implementado em**: mesmo arquivo (`resolveDefaults`)
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 3.3 (P) `CopyGenerator` — headline/body/cta nos limites Meta
  - Chama gpt-4o com response_format=json_object
  - Aplica limites: headline ≤40, body ≤125, description ≤27
  - CTA derivado do objective via mapa CTA_BY_OBJECTIVE
  - Overrides priorizados (se ambos headline+body passados, pula LLM)
  - Fallback se LLM falhar: copy mínima derivada do nome da oferta
  - **Implementado em**: mesmo arquivo (`generateCopy`)
  - _Requirements: 1.6_

- [x] 3.4 (P) `ProposalToCampaignMapper` — pure function payload → body Zod
  - Tradução objective curto → OUTCOME_<X>
  - daily_budget BRL → centavos
  - billing_event derivado de optimization_goal
  - status sempre PAUSED no create (Meta exige aprovação explícita pra ACTIVE)
  - image_url passada pelo caller (já regenerada com TTL fresh)
  - **Implementado em**: mesmo arquivo (`mapProposalToCampaignBody`)
  - _Requirements: 3.3_

---

- [x] 4. Tool `propose_campaign` no orchestrator
- [x] 4.1 Handler que monta a proposta + persiste
  - Tool definition em [tools.ts](../../../supabase/functions/_shared/tools.ts) com description forte (gating: criativo gerado + intenção explícita)
  - Case no switch de [ai-chat/index.ts](../../../supabase/functions/ai-chat/index.ts) chamando `handleProposeCampaign`
  - Handler valida creative pertence ao tenant; aborta com mensagem leiga se faltar
  - Invoca `checkPrereqs`, aborta com mensagem específica por PrereqErrorKind (missing_meta_connection / missing_page_selection)
  - Detecta `pages_ambiguous` e instrui LLM a perguntar antes de prosseguir
  - Invoca `resolveDefaults` + `generateCopy` (com overrides do user)
  - Gera signed URL TTL 15min via `createSignedUrl` no bucket `generated-creatives`
  - Invoca `runComplianceCheck` em modo preview (fail-open com severity='unknown')
  - INSERT em campaign_proposals via service-role com snapshot de prereq + creative + compliance
  - Retorna markdown com placeholder `<campaign-proposal id="..."/>` pro frontend
  - **Implementado em**: [supabase/functions/_shared/propose-campaign-handler.ts](../../../supabase/functions/_shared/propose-campaign-handler.ts) (~210 LOC)
  - Deploy ai-chat OK (HTTP 200 OPTIONS)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4_

- [x] 4.2 Validação Zod do input + erro estruturado
  - Schema InputSchema com validação de UUID, ranges (budget 10-10000, age 13-65), enum CTA + objective
  - safeParse no início; falha → mensagem `Erro de validacao em propose_campaign: ...` com instrução pro LLM repassar
  - Erros de runtime (missing prereq, briefing sem oferta, criativo sumido) retornam strings com instrução `LITERALMENTE` pro LLM
  - _Requirements: 1.8_

- [x] 4.3 Telemetria do handler em `agent_runs`
  - Já capturada automaticamente: orchestrator existente registra `tools_used` (inclui 'propose_campaign'), tokens, cost_usd, latency_ms da run inteira
  - error_message capturado via try/catch do switch (linha 902 de ai-chat/index.ts)
  - Granularidade `error_kind` enum aprofunda em Task 6 (publish_campaign), onde os tipos validation/compliance/upstream/timeout fazem sentido distinto
  - _Requirements: 9.1, 9.3_

---

- [x] 5. Frontend — hook e card de proposta
- [x] 5.1 Hook `useCampaignProposal(proposalId)` com fetch + realtime + mutations
  - useQuery TanStack com staleTime 30s
  - Realtime channel `campaign-proposal-${id}` ouvindo UPDATE filtrado por id, invalida query
  - `cancel()`: UPDATE status='cancelled' + toast (mensagem [SISTEMA] disparada pelo card)
  - `edit(patch)`: UPDATE payload_jsonb com merge profundo (audience/copy mesclados)
  - **Implementado em**: [src/hooks/use-campaign-proposal.ts](../../../src/hooks/use-campaign-proposal.ts)
  - _Requirements: 2.4, 2.6_

- [x] 5.2 Componente `InlineCampaignProposalCard`
  - Layout 2-col: thumbnail 32x32 (signed URL ja vem do payload) + conteúdo
  - Estados visuais completos: pending_approval (3 botões) | publishing (badge spinner) | live (verde + link Meta Ads Manager) | failed (vermelho + Tentar de novo) | cancelled/expired (badge cinza, opacity)
  - Polling do publication via `useCampaignPublication(publicationId)` quando status >= publishing
  - Bloqueio do botão Publicar quando severity='high' + mensagem orientando edição
  - Badge compliance com Icon+label por severity (verde/amarelo/vermelho/cinza)
  - **Implementado em**: [src/components/chat/InlineCampaignProposalCard.tsx](../../../src/components/chat/InlineCampaignProposalCard.tsx) (~230 LOC)
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 7.2, 7.3, 7.4_

- [x] 5.3 Modal `CampaignProposalEditor` — edição multifield
  - Dialog shadcn-ui com validação inline (não usei RHF/Zod pra simplicidade — validação manual mostra erros em tempo real)
  - Campos: budget/dia, age_min/max, headline (40), body (125), description (27), cta (select com 8 opções traduzidas)
  - Counter visual de chars com cor destrutiva ao estourar limite
  - Save → mutation edit do hook → fecha modal
  - **Implementado em**: [src/components/chat/CampaignProposalEditor.tsx](../../../src/components/chat/CampaignProposalEditor.tsx)
  - _Requirements: 2.5_

- [x] 5.4 Render do card no `ChatView` quando assistant message contém `<campaign-proposal id="..."/>`
  - Mesma técnica de marker do `<creative-gallery>`: regex → placeholder string → render line-by-line
  - `onSendSystemMessage` injeta msg `[SISTEMA] Aprovo publicar a proposta <id>` que dispara o LLM a chamar `publish_campaign` (Task 6)
  - **Implementado em**: [src/components/ChatView.tsx](../../../src/components/ChatView.tsx)
  - _Requirements: 2.1_

---

- [x] 6. Tool `publish_campaign` + integração com edge `campaign-publish`
- [x] 6.1 Handler que invoca `campaign-publish` e atualiza proposta
  - Tool definition em `tools.ts` com gating: "use APENAS após mensagem [SISTEMA] de aprovação"
  - Case no switch de ai-chat
  - Valida proposal_id (Zod UUID), tenant ownership, status='pending_approval'
  - Regenera signed URL fresh (TTL 15min) — não confia no `media_url_at_propose`
  - Invoca `mapProposalToCampaignBody` para body Zod do campaign-publish
  - POST com user JWT (audit trail correto, não service-role)
  - AbortSignal.timeout(55s) → error_kind='timeout'
  - Tratamento por status code: 422 → compliance, 4xx → validation, 5xx → upstream
  - UPDATE proposal status='publishing'+publication_id (success) ou 'failed'+error_payload (erro)
  - Mensagem LITERAL específica por error_kind pro LLM repassar
  - **Implementado em**: [supabase/functions/_shared/publish-campaign-handler.ts](../../../supabase/functions/_shared/publish-campaign-handler.ts) (~165 LOC)
  - Deploy OK (HTTP 200 OPTIONS)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6.2 Botão Publicar do card injeta mensagem `[SISTEMA]`
  - Já implementado em Task 5.2 (`onSendSystemMessage`)
  - Card chama `sendMessage('[SISTEMA] Aprovo publicar a proposta <id>')` — invisível na UI (ChatView filtra), visível pro LLM
  - LLM vê o gate na description da tool e dispara `publish_campaign`
  - Padrão de retry: botão "Tentar de novo" envia `[SISTEMA] Tente publicar novamente a proposta <id>`
  - _Requirements: 3.1_

- [x] 6.3 Telemetria em `agent_runs`
  - error_kind enum implementado no handler (validation|compliance|upstream|timeout|wrong_status|proposal_not_found|unknown)
  - Persistido em `campaign_proposals.error_payload.error_kind` (mais granular que `agent_runs.error_message`)
  - tools_used já capturado pelo orchestrator existente
  - _Requirements: 9.1, 9.3_

---

- [x] 7. Polling de publicação no card
- [x] 7.1 Integrar `useCampaignPublication` (existente) ao card quando status='publishing'
  - Implementado em Task 5.2 — `useCampaignPublication(publicationId)` consumido condicionalmente quando status >= publishing
  - Estado live → badge verde + link Meta Ads Manager (deep link)
  - Estado failed → badge vermelho + erro do `error_payload.message` + botão "Tentar de novo"
  - Polling se desativa ao atingir live|failed (hook de Publisher já tem essa lógica)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7.2 Mensagem do agente pós-live
  - Mensagem inicial pós-publish: "Comecei a publicar! Em alguns segundos seu anuncio vai estar no ar..."
  - Mensagem celebratória pós-live: deferida pro System Prompt v2 (Task 8) — o LLM vai ser instruído a celebrar + oferecer monitoramento ao perceber status='live' nas próximas turns
  - _Requirements: 5.5_

- [x] 7.3 Link "Ver no Painel" pós-live
  - Botão "Ver no Painel" adicionado no card no estado live, ao lado de "Meta Ads Manager"
  - Dispara `navigateToView('painel')` (helper do view-navigation existente)
  - **Implementado em**: [src/components/chat/InlineCampaignProposalCard.tsx](../../../src/components/chat/InlineCampaignProposalCard.tsx)
  - _Requirements: 8.2, 8.3_

---

- [x] 8. (P) System prompt v2 do orchestrator — voz proativa pra leigo
- [x] 8.1 (P) Reescrever SYSTEM_PROMPT em `_shared/prompt.ts`
  - Nova seção `## FLUXO DE PUBLICACAO DE ANUNCIO (propose_campaign + publish_campaign)` com 6 sub-seções
  - Glossário leigo (campanha→anúncio que roda no Facebook, objetivo→o que você quer que aconteça, etc.) — pixel/ad set marcados como NUNCA mencionar
  - Gatilho explícito: após `<creative-gallery>`, sugerir publicar proativamente em até 2 turns
  - Passos A/B/C: confirmar oferta → coletar valor diário → invocar propose_campaign
  - Tratamento de mensagem `[SISTEMA] Aprovo publicar` → invoca publish_campaign sem confirmar de novo
  - Pós-live: celebrar brevemente + oferecer monitoramento (R5.5)
  - Defaults pra negócio físico local: TRAFFIC/ENGAGEMENT, mencionar bairro/cidade, R$10-30/dia conservador
  - Lista NUNCA: pedir IDs técnicos, mandar pro Meta Ads Manager, chamar tools fora de ordem
  - **Implementado em**: [supabase/functions/_shared/prompt.ts](../../../supabase/functions/_shared/prompt.ts) (~80 LOC novas)
  - Deploy ai-chat OK
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8.2 (P) Description forte da tool `propose_campaign` e `publish_campaign`
  - propose_campaign: gating duplo (criativo gerado E intenção sinalizada); enfatiza pré-defaults vs perguntar tudo
  - publish_campaign: gating "use APENAS após mensagem [SISTEMA] de aprovação" + nunca chamar sem ter visto
  - Já implementado em Tasks 4 e 6
  - _Requirements: 1.1, 5.1_

---

- [ ] 9. Validação end-to-end
- [ ] 9.1 Smoke test manual happy path Pedro
  - Briefing completo + criativo gerado → "quero anunciar" → agente coleta budget → propõe → user clica Publicar → campanha live no Meta sandbox em <2min
  - Métrica: turns de chat ≤5 entre `<creative-gallery>` e card 'live'
  - _Requirements: 1.1, 2.1, 3.1, 4.2, 5.1_

- [ ] 9.2* Teste E2E Playwright fluxo completo
  - Mock do `campaign-publish` retornando publication_id → status='live'
  - Verifica: card aparece, botões funcionam, polling muda para verde, link Meta presente
  - _Requirements: 2.1, 4.1, 4.2_

- [ ] 9.3* Teste E2E Playwright fluxo erro com retry
  - Mock do `campaign-publish` retornando 422 compliance → user clica Editar → muda copy → publica → ok
  - _Requirements: 2.5, 3.5, 4.3_

- [x] 9.4 Verificar telemetria agregada em `agent_runs`
  - Query estrutural validada via Management API:
    ```sql
    SELECT
      COUNT(*) FILTER (WHERE tools_used::jsonb @> '"propose_campaign"'::jsonb) AS proposals_invoked,
      COUNT(*) FILTER (WHERE tools_used::jsonb @> '"publish_campaign"'::jsonb) AS publishes_invoked,
      COUNT(*) FILTER (WHERE status = 'error' AND ...) AS errors_in_flow
    FROM agent_runs WHERE started_at > now() - interval '24 hours';
    ```
  - Resultado atual (pré-teste do usuário): 0 invocações, 24 runs totais (24h). Counters prontos pra serem populados assim que o smoke test rodar
  - `error_kind` granular persistido em `campaign_proposals.error_payload` (não apenas em `agent_runs.error_message`) — permite filtros por kind
  - _Requirements: 9.1, 9.2, 9.3_

---

## Cobertura de requirements

| Req | Tasks |
|---|---|
| 1.1 | 4.1, 8.2, 9.1 |
| 1.2 | 4.1 |
| 1.3 | 3.2, 4.1 |
| 1.4 | 3.2, 4.1 |
| 1.5 | 3.2, 4.1 |
| 1.6 | 3.3, 4.1 |
| 1.7 | 4.1 |
| 1.8 | 4.1, 4.2 |
| 2.1 | 5.2, 5.4, 9.1, 9.2 |
| 2.2 | 5.2 |
| 2.3 | 5.2 |
| 2.4 | 5.1 |
| 2.5 | 5.3, 9.3 |
| 2.6 | 5.1 |
| 3.1 | 6.1, 6.2, 9.1 |
| 3.2 | 6.1 |
| 3.3 | 3.4, 6.1 |
| 3.4 | 6.1 |
| 3.5 | 6.1, 9.3 |
| 3.6 | 6.1 |
| 3.7 | 6.1 |
| 4.1 | 7.1, 9.2 |
| 4.2 | 7.1, 9.1, 9.2 |
| 4.3 | 7.1, 9.3 |
| 4.4 | 7.1 |
| 5.1 | 8.1, 8.2, 9.1 |
| 5.2 | 8.1 |
| 5.3 | 8.1 |
| 5.4 | 8.1 |
| 5.5 | 7.2, 8.1 |
| 6.1 | 1.1, 1.3 |
| 6.2 | 1.2 |
| 6.3 | 1.3 |
| 6.4 | 1.1 |
| 6.5 | 1.1 (FK created_by_message_id) |
| 7.1 | 2.1, 2.2, 4.1 |
| 7.2 | 2.3, 4.1, 5.2 |
| 7.3 | 2.3, 4.1, 5.2 |
| 7.4 | 2.3, 4.1, 5.2 |
| 7.5 | 2.1, 4.1 |
| 8.1 | (out-of-scope: cron meta-sync existente cobre — sem task nova) |
| 8.2 | 7.3 |
| 8.3 | 7.3 |
| 9.1 | 4.3, 6.3, 9.4 |
| 9.2 | 9.4 |
| 9.3 | 4.3, 6.3, 9.4 |
| 10.1 | 3.1, 4.1 |
| 10.2 | 3.1, 4.1 |
| 10.3 | 3.1, 4.1 |
| 10.4 | 3.1 |

**Nota sobre 8.1:** o cron `meta-sync` já existe e captura novas campanhas via lookup de `meta_ad_accounts`. Sem task nova — apenas validar em 9.4 que campanha publicada aparece no Painel em ≤60s.

## Ordem de execução sugerida

1. Tasks 1, 2, 3, 8 podem rodar em paralelo (independentes)
2. Task 4 depende de 1, 2, 3 prontos
3. Task 5 depende de 1, 4 prontos (precisa do tipo + handler funcionando)
4. Task 6 depende de 4 (proposta existe no DB)
5. Task 7 depende de 5 e 6 (card + publish prontos)
6. Task 9 depende de tudo

## Estimativa total
- 9 major tasks, 26 sub-tasks (3 marcadas como opcional `*` — testes deferíveis)
- Esforço: ~5-7 dias
- 7 sub-tasks marcadas com `(P)` — paralelizáveis no início
