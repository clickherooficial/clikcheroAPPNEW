# Implementation Plan — business-archetype-personas

> Spec: `.kiro/specs/business-archetype-personas/`
> Modo: parallel-aware (tasks marcadas com `(P)` podem rodar em paralelo)

## Pré-requisitos

- Requirements aprovados ✅
- Design aprovado ✅
- Fase 1 (chat-publish-flow) implementada — handlers e tipos disponíveis pra estender

---

- [x] 1. (P) Migration ALTER ADD COLUMN business_archetype
  - ALTER TABLE company_briefings ADD COLUMN business_archetype text com CHECK (NULL ou 1 dos 4 enums)
  - Sem default, sem NOT NULL — rows existentes ficam NULL preservando comportamento
  - Migration aditiva (segue SAFETY_PROTOCOL); sem index extra (cardinalidade baixa, query sempre por PK)
  - Aplicar via Management API (mesma técnica da Fase 1)
  - Comentário de coluna documentando o enum
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

---

- [ ] 2. Tipos TS + ArchetypeReader
- [x] 2.1 (P) Adicionar `Archetype` type em `src/types/business-archetype.ts`
  - Union literal: `'small_local_business' | 'online_seller' | 'service_provider' | 'info_product'`
  - Helper `ARCHETYPE_LABELS: Record<Archetype, string>` com labels PT leigo
  - Helper `ARCHETYPE_DESCRIPTIONS: Record<Archetype, string>` (1 frase descritiva por opção pra Settings UI)
  - _Requirements: 1.1, 3.2_

- [x] 2.2 (P) Função `readArchetype` em `_shared/archetype-reader.ts`
  - SELECT business_archetype FROM company_briefings WHERE company_id = $1
  - Valida valor lido contra enum; se inválido (corrupção), retorna null + console.warn
  - Sem cache (mudança em Settings reflete imediato)
  - _Requirements: 1.3, 4.7_

---

- [ ] 3. archetype-detector — módulo + edge function
- [x] 3.1 (P) Listas de keywords por arquétipo + função `matchByKeyword`
  - 4 arrays de strings em `_shared/archetype-detector.ts` (small_local_business, online_seller, service_provider, info_product) — listas curadas no PR (ver R-06 do research)
  - Função `matchByKeyword(input: DetectorInput): Archetype | null` que aplica lowercase + indexOf nas strings concatenadas (niche + niche_category + short_description)
  - Pondera primary_offer_format antes (course → info_product, service → service_provider, physical → small_local_business)
  - Retorna primeiro match; se múltiplos, decide por ordem de prioridade format > niche > description
  - _Requirements: 2.2_

- [x] 3.2 LLM fallback `classifyViaLLM` no mesmo arquivo
  - Chama gpt-4o-mini com response_format=json_object
  - Prompt curto: "Classifique este negócio em UM dos 4: small_local_business | online_seller | service_provider | info_product. Negócio: {niche}, {short_description}. Responda apenas o valor JSON."
  - Timeout 8s via AbortSignal.timeout
  - Falha (timeout/JSON inválido/sem API key) → retorna null + log warn
  - _Requirements: 2.3, 2.6_

- [x] 3.3 Função orquestradora `detectArchetype`
  - Tenta matchByKeyword primeiro; se null, classifyViaLLM
  - Retorna DetectionResult discriminada por method ('keyword' | 'llm' | 'failed' | 'skipped')
  - Confidence: keyword=0.85, llm=0.6 (ou o que o modelo declarar se conseguirmos extrair)
  - _Requirements: 2.1, 2.6_

- [x] 3.4 Edge Function `archetype-detector` (POST endpoint)
  - Body: `{ company_id }` — verify_jwt = false (chamada do FE com user JWT no header)
  - Lê briefing do tenant; se business_archetype IS NOT NULL, retorna `{ archetype, method: 'skipped' }` SEM chamar LLM (idempotência R2.5)
  - Se NULL: invoca detectArchetype, faz UPDATE em company_briefings.business_archetype quando não-null
  - Se ENABLE_ARCHETYPE_PERSONAS=='false', retorna no-op imediato com `method: 'disabled'`
  - Loga em agent_runs com agent_name='archetype-detector' (companyId, method, latency)
  - _Requirements: 2.1, 2.4, 2.5, 2.6, 8.4_

---

- [ ] 4. archetype-backfill — Edge Function one-shot
- [x] 4.1 Loop com lotes de 10 + sleep 6s
  - Body opcional: `{ batch_size?: number; max_total?: number }` — defaults 10 e 1000
  - SELECT id, company_id FROM company_briefings WHERE status='complete' AND business_archetype IS NULL ORDER BY created_at LIMIT batch_size
  - Para cada row: invoca archetype-detector internamente (reusa código)
  - Sleep 6s entre lotes (rate limit OpenAI conservador)
  - Critério de parada: nenhum row pendente OU max_total alcançado
  - Loga totais (processados, classificados, falhados) em agent_runs com agent_name='archetype-backfill'
  - Idempotente naturalmente (skipa rows com archetype setado)
  - _Requirements: 7.1, 7.2_

- [x] 4.2 (P) Query SQL de cobertura (sem UI dedicada)
  - Documenta query em README/comment: `SELECT business_archetype, COUNT(*) FROM company_briefings WHERE status='complete' GROUP BY business_archetype;`
  - Pode ser rodada via Management API quando precisar verificar cobertura
  - _Requirements: 7.3_

---

- [ ] 5. Extensões em `_shared/campaign-proposal-helpers.ts` (BriefingResolver + CopyGenerator)
- [x] 5.1 (P) Mapas estáticos por arquétipo
  - `OBJECTIVE_BY_ARCHETYPE: Partial<Record<Archetype, CampaignObjective>>`
  - `CTA_BY_ARCHETYPE: Partial<Record<Archetype, MetaCtaEnum>>`
  - `OPTIMIZATION_BY_ARCHETYPE: Partial<Record<Archetype, MetaOptimizationGoal>>` (ex: online_seller → CONVERSIONS)
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 5.2 Estender `resolveDefaults` com argumento `archetype`
  - Nova assinatura aceita `archetype?: Archetype | null`
  - Quando ausente, lê via readArchetype (fallback)
  - Precedência: overrides > OBJECTIVE_BY_ARCHETYPE > OBJECTIVE_BY_FORMAT (mantido como base)
  - Mesmo padrão para CTA e optimization_goal
  - When archetype=null: comportamento Fase 1 preservado integralmente
  - _Requirements: 6.1, 6.7, 6.8_

- [x] 5.3 Estender `generateCopy` com `archetype` no input
  - Hint adicional no system prompt do gpt-4o por arquétipo (ex.: "para small_local_business: mencione bairro/cidade quando souber")
  - Quando archetype=null: prompt sem hint (Fase 1 preservada)
  - _Requirements: 6.6_

---

- [ ] 6. System prompt v3 — bloco condicional + ai-chat orchestrator extension
- [x] 6.1 Arquivo `_shared/prompt-archetype-blocks.ts` com 4 strings
  - `ARCHETYPE_BLOCKS: Record<Archetype, string>` com 4 blocos de ~30 linhas cada
  - small_local_business: bairro/cidade, sugerir ENGAGEMENT/TRAFFIC, exemplos com "vizinhos"
  - online_seller: promo/cupom/frete, sugerir SALES, exemplos "carrinho abandonado", recomendar Pixel se faltar
  - service_provider: agendamento WhatsApp, LEADS com CTA WHATSAPP_MESSAGE, exemplos "primeiro orçamento"
  - info_product: transformação/aula gratis, LEADS com SIGN_UP, evitar promessas exageradas
  - Texto exato escrito no PR (research.md flagged como deferred)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6.2 Compor SYSTEM_PROMPT condicionalmente em ai-chat/index.ts
  - Após resolver companyId (já feito), invocar `readArchetype`
  - Se archetype não-null AND ENABLE_ARCHETYPE_PERSONAS != 'false': append `\n\n${ARCHETYPE_BLOCKS[archetype]}` ao SYSTEM_PROMPT
  - Se null: usa SYSTEM_PROMPT base (Fase 2 preservada)
  - _Requirements: 4.1, 4.6, 4.7, 8.4_

- [x] 6.3 Passar archetype pro propose_campaign handler
  - Handler já recebe companyId; passar archetype lido pra resolveDefaults e generateCopy
  - Se nulo, comportamento Fase 1 puro
  - _Requirements: 6.1_

---

- [ ] 7. Frontend — ArchetypeSelector + quickstart cards condicionais
- [x] 7.1 (P) Estender `useBriefing` hook com `business_archetype`
  - Adicionar campo na query do briefing
  - Mutation `updateArchetype(value: Archetype | null)` → UPDATE company_briefings.business_archetype
  - _Requirements: 3.3_

- [x] 7.2 Componente `ArchetypeSelector` em `src/components/briefing/ArchetypeSelector.tsx`
  - Select shadcn-ui com 5 opções (4 arquétipos + "Não sei / Misto" → null)
  - Labels PT leigo de ARCHETYPE_LABELS
  - Descrição inline embaixo de cada opção (ARCHETYPE_DESCRIPTIONS)
  - Auto-save: onChange dispara updateArchetype + toast de confirmação
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7.3 Inserir ArchetypeSelector dentro de BriefingView (na aba Identidade do Cerebro)
  - Adicionar como nova seção colapsável (Accordion) ou bloco dedicado no topo
  - _Requirements: 3.1_

- [x] 7.4 (P) `src/lib/quickstart-cards.ts` — mapa por arquétipo
  - `QUICKSTART_BY_ARCHETYPE: Record<Archetype | 'fallback', QuickstartCard[]>`
  - 4 cards por arquétipo conforme R5.2-5.5 (texto exato escrito no PR)
  - Função `getQuickstartCards(archetype: Archetype | null): QuickstartCard[]` com fallback genérico
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7.5 ChatView consome cards condicionais
  - Ler archetype via useBriefing
  - Substituir array literal de `suggestions` por `getQuickstartCards(archetype)`
  - Render condicional preservado (só mostra no welcome state quando messages.length===0)
  - _Requirements: 5.1, 5.7_

---

- [ ] 8. Detecção automática no fim do BriefingWizard
- [x] 8.1 Hook `useArchetypeDetection` que invoca edge fn
  - POST /functions/v1/archetype-detector com `{ company_id }`
  - Aceita falha silenciosa (NULL fica NULL — usuário pode setar manual)
  - _Requirements: 2.1_

- [x] 8.2 BriefingWizard chama detector ao finalizar (step 7 onFinish)
  - Após o último UPDATE do briefing, dispara useArchetypeDetection assíncrono (fire-and-forget)
  - Não bloqueia navegação pra '/'
  - Se ENABLE_ARCHETYPE_PERSONAS desativado, no-op
  - _Requirements: 2.1, 2.4, 2.6, 8.4_

---

- [ ] 9. Telemetria + feature flag
- [x] 9.1 (P) Quickstart card click → log em agent_runs.metadata
  - ChatView ao chamar handleSuggestionClick: incluir `business_archetype` no metadata da próxima sendMessage (via parâmetro extra ou metadata persistida na mensagem do user)
  - _Requirements: 8.1_

- [x] 9.2 propose_campaign handler inclui archetype no metadata do agent_runs
  - Já loga via tools_used; adicionar `metadata.business_archetype` na linha do run
  - _Requirements: 8.2_

- [x] 9.3 (P) Documentar feature flag ENABLE_ARCHETYPE_PERSONAS
  - Adicionar entrada em .env.example + steering (tech.md ou implemented-features.md) com instruções de uso
  - Default ON (ausente = ON); setar literal "false" pra desligar
  - _Requirements: 8.4_

- [x] 9.4 Tratamento de detecção crônica falhada
  - Se 3 tentativas de backfill resultarem null pra mesmo company_id, log warning destacado em agent_runs.error_message — mas NÃO bloqueia usuário
  - Comportamento genérico (fallback Fase 1) é sempre seguro
  - _Requirements: 8.3_

---

- [ ] 10. Validação end-to-end
- [ ] 10.1 Smoke test manual happy path por arquétipo
  - 4 cenários: criar briefing teste com niche="padaria" / "loja online de bijuteria" / "eletricista 24h" / "curso de confeitaria online"
  - Verificar: archetype detectado correto após onFinish; quickstart cards condizentes ao reabrir chat; system prompt entregue ao gpt-4o tem o bloco certo (verificar via log de invocação)
  - _Requirements: 2.1, 4.1, 5.1_

- [ ] 10.2* (P) Snapshot tests do detectArchetype
  - 8 fixtures (2 por arquétipo) cobrindo keyword match e LLM fallback
  - _Requirements: 2.2, 2.3_

- [ ] 10.3* (P) E2E Playwright: trocar archetype no Settings → recarregar chat → quickstart cards mudaram
  - _Requirements: 3.3, 5.1_

- [ ] 10.4 Verificar telemetria por arquétipo via API
  - Query SQL: `SELECT business_archetype, tools_used, COUNT(*) FROM agent_runs JOIN company_briefings USING(company_id) WHERE started_at > now() - interval '7d' GROUP BY ...`
  - Confirma que metadata.business_archetype está sendo populado
  - _Requirements: 8.1, 8.2_

---

## Cobertura de requirements

| Req | Tasks |
|---|---|
| 1.1 | 1, 2.1 |
| 1.2 | 1 |
| 1.3 | 2.2 |
| 1.4 | 1 |
| 1.5 | 1 |
| 2.1 | 3.3, 3.4, 8.1, 8.2, 10.1 |
| 2.2 | 3.1, 10.2 |
| 2.3 | 3.2, 10.2 |
| 2.4 | 3.4, 8.2 |
| 2.5 | 3.4 |
| 2.6 | 3.2, 3.3, 3.4, 8.2 |
| 3.1 | 7.2, 7.3 |
| 3.2 | 2.1, 7.2 |
| 3.3 | 7.1, 7.2, 10.3 |
| 3.4 | 7.2 |
| 4.1 | 6.1, 6.2, 10.1 |
| 4.2 | 6.1 |
| 4.3 | 6.1 |
| 4.4 | 6.1 |
| 4.5 | 6.1 |
| 4.6 | 6.2 |
| 4.7 | 2.2, 6.2 |
| 5.1 | 7.4, 7.5, 10.1, 10.3 |
| 5.2 | 7.4 |
| 5.3 | 7.4 |
| 5.4 | 7.4 |
| 5.5 | 7.4 |
| 5.6 | 7.4 |
| 5.7 | 7.5 |
| 6.1 | 5.2, 6.3 |
| 6.2 | 5.1 |
| 6.3 | 5.1 |
| 6.4 | 5.1 |
| 6.5 | 5.1 |
| 6.6 | 5.3 |
| 6.7 | 5.2 |
| 6.8 | 5.2 |
| 7.1 | 4.1 |
| 7.2 | 4.1 |
| 7.3 | 4.2 |
| 8.1 | 9.1, 10.4 |
| 8.2 | 9.2, 10.4 |
| 8.3 | 9.4 |
| 8.4 | 3.4, 6.2, 8.2, 9.3 |

## Ordem de execução sugerida

1. Task 1 (migration) bloqueia tudo
2. Tasks 2, 3, 5, 6.1 podem rodar em paralelo após 1
3. Task 4 (backfill) depende de 3 pronto
4. Task 6.2/6.3 depende de 2.2 + 6.1
5. Task 7 (frontend) depende de 1 (precisa do tipo no DB) + 2.1 (tipo TS)
6. Task 8 (detecção no wizard) depende de 3.4 (edge fn pronta)
7. Task 9 telemetria intercala
8. Task 10 valida tudo

## Estimativa total
- 10 major tasks, 28 sub-tasks (3 marcadas como opcional `*`)
- Esforço: ~3-5 dias
- 9 sub-tasks marcadas com `(P)` — paralelizáveis no início
