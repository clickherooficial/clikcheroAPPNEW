# Gap Analysis — chat-publish-flow

> Spec: `.kiro/specs/chat-publish-flow/`
> Geração: 2026-05-01

## Contexto

Brownfield denso. A maior parte da infra já existe e funciona; o gap é pequeno em superfície mas estratégico em conexão. A escolha-chave é **REUSAR** o padrão de `approvals` (HITL) ao invés de inventar tabela/UI nova.

---

## 1. Requirement-to-Asset Map

| Req | Capability necessária | Asset existente | Status |
|---|---|---|---|
| R1 | Tool `propose_campaign` no orchestrator | Slot vazio em [ai-chat:893](supabase/functions/ai-chat/index.ts#L893) (default branch); padrão estabelecido em `propose_pause_campaign`/`propose_update_budget` ([data-fetchers.ts:741+](supabase/functions/_shared/data-fetchers.ts)) | **Missing** (criar handler novo) |
| R1.4 | Pré-preencher targeting do briefing | `briefing.audience` jsonb (ageRange, location, interests) já populado pela briefing-onboarding | **OK** |
| R1.6 | Gerar copy 40/125/27 | LLM dentro da tool faz isso (usa briefing.tone) | **OK** (lógica no handler) |
| R1.7 | Persistir proposta | `approvals` table tem campos genéricos (`payload jsonb`, `status`, `expires_at`) — comporta uma `action_type='campaign_publish_proposal'` SEM nova tabela | **Constraint** (ver Decisão 1) |
| R2 | Card inline com thumbnail+copy+público+budget+badge | `InlineApprovalCard` ([linha 1-198](src/components/chat/InlineApprovalCard.tsx)) — só renderiza linha simples + plan; NÃO tem visual rico p/ campanha | **Hybrid** (criar `InlineCampaignProposalCard` reusando hook+mutation) |
| R2.5 | Modal de edição | `RuleEditModal` ([fury/RuleProposalCard.tsx:143](src/components/fury/RuleProposalCard.tsx#L143)) — padrão Dialog+Form+save → UPDATE jsonb | **OK** (replicar padrão) |
| R2.6 | Realtime do card | `use-approvals.ts` ([linhas 69-96](src/hooks/use-approvals.ts#L69-L96)) — channel já filtra por conversation_id | **OK** (reusar) |
| R3 | Tool `publish_campaign` | `campaign-publish` edge ([campaign-publish/index.ts](supabase/functions/campaign-publish/index.ts)) — Zod schema completo, rollback nativo | **OK** (handler invoca via fetch) |
| R3.7 | Lookup de ad_account/page/pixel | Tabelas `meta_ad_accounts`, `meta_pages`, `meta_pixels` (em migrations meta-deep-scan e meta-assets) — sem coluna `is_default`, precisa heurística | **Constraint** (ver Decisão 4) |
| R4 | Polling status `publishing → live/failed` | `campaign_publications.status` workflow + polling pattern já no `PublicationStatus` do CampaignPublisherView | **OK** (reusar hook ou criar similar) |
| R5 | System prompt v2 leigo | `_shared/prompt.ts` (SYSTEM_PROMPT) — única fonte; só editar | **OK** |
| R6 | Tabela `campaign_proposals` | Pode ser **novo** OU **reusar `approvals`** com `action_type='campaign_publish_proposal'` | **Decisão crítica** |
| R7 | Compliance pre-check (dry-run) | `compliance-officer` edge fn — não tem dry-run nativo; `rescan_compliance` analisa mas grava | **Unknown** (Pesquisa Necessária 1) |
| R8 | Disparar `meta-sync` pós-live | `meta-sync` edge fn aceita scope; pode invocar de dentro de `publish_campaign` ou agendar via `pg_cron` | **OK** (escolher caminho no design) |
| R9 | Telemetria | `agent_runs` ([migrations/20260424000004](supabase/migrations/20260424000004_agent_runs.sql)) — schema completo, padrão estabelecido | **OK** |
| R10 | Gate de pré-requisitos | Checks simples via SELECT em `meta_ad_accounts`, `meta_pages` + `v_company_briefing_status` | **OK** |

---

## 2. Decisões críticas (com opções)

### Decisão 1: Persistência da proposta — `approvals` reuso vs. tabela nova `campaign_proposals`

**Opção A — Reusar `approvals` com `action_type='campaign_publish_proposal'`**
- ✅ Zero migration, zero RLS nova, zero realtime/hook novo
- ✅ Padrão HITL unificado: aprovar/rejeitar/expirar funciona out-of-the-box
- ✅ `payload jsonb` aceita o blob completo do `campaign-publish` body
- ❌ Mistura semântica: `approvals` hoje é "ação atômica" (pause/budget/etc), proposta de campanha é "doc complexo editável"
- ❌ Edição (R2.5) precisaria UPDATE em `approvals.payload` — é admitido pela schema mas foge do padrão de "approvals são imutáveis até decidir"

**Opção B — Tabela nova `campaign_proposals`** (como spec original sugere)
- ✅ Semântica clara: doc editável com lifecycle próprio (pending → cancelled/publishing/live/failed)
- ✅ FK direta pra `campaign_publications` (publication_id)
- ✅ Permite versionar edits sem confundir com aprovações de outras ações
- ❌ Migration nova + RLS + hook novo + componente novo = mais código
- ❌ Duplicação de pattern (2 caminhos de HITL no chat)

**Opção C — Híbrido**: tabela nova `campaign_proposals` MAS o card inline e mutation reusam o componente genérico `InlineApprovalCard` extendido
- Foge da pureza visual do "card de campanha" (que precisa de thumbnail + targeting visual)

**Recomendação:** **Opção B**. A complexidade do card (thumbnail+badge compliance+edição multifield) justifica componente próprio; a divergência semântica vs. `approvals` é real (proposta é editável e tem polling de status pós-publicação que `approvals` não tem). Custo extra: ~150 LOC de migration + hook + componente.

### Decisão 2: Onde mora a lógica de "mapear payload→Zod do campaign-publish"

**Opção A** — dentro do handler `publish_campaign` em `_shared/data-fetchers.ts` (helper)
**Opção B** — função separada em `_shared/campaign-proposal.ts` (novo módulo, reusável por edge fn de teste)

**Recomendação:** B — modulariza e facilita teste unitário do mapeamento.

### Decisão 3: Pre-check de compliance (R7) — fonte única vs. paralela

`campaign-publish` JÁ tem compliance gate definitivo (Claude Vision + copy). A pré-checagem no card é **preview** pra UX.

**Opção A** — chamar `compliance-officer` (modo análise read-only, ignora insert) — **Pesquisa Necessária**: tem flag `dry_run`?
**Opção B** — extrair função de scoring de `campaign-publish` em helper compartilhado e invocá-la em ambos os pontos
**Opção C** — pular pre-check; só mostrar resultado depois que `campaign-publish` retornar (UX pior — usuário clica Publicar e descobre que foi bloqueado)

**Recomendação:** **B**. Refatorar `campaign-publish` extraindo `runComplianceCheck()` pra `_shared/compliance-runner.ts`; usar em ambos. Custo médio mas resolve dois problemas (dry-run + DRY).

### Decisão 4: Como escolher ad_account/page/pixel quando há múltiplos

Tenant pode ter mais de 1 conta Meta, mais de 1 página. Não há coluna `is_default`.

**Opção A** — assumir o primeiro ativo (heurística simples)
**Opção B** — adicionar `is_primary boolean` em `meta_ad_accounts` e `meta_pages`, settável via Integrations
**Opção C** — pedir ao usuário pelo chat ("Qual página você quer usar?")

**Recomendação para esta spec:** **A** com fallback pra **C** se ambíguo (>1 ativo). **B** vira spec separada de "Preferences de Meta defaults" (Fase 2). R10.4 ("nunca pedir IDs técnicos") fica preservado porque a pergunta vira "qual loja/página?" listando nomes amigáveis.

### Decisão 5: Trigger do `meta-sync` pós-live (R8)

**Opção A** — chamar `meta-sync` ao final de `campaign-publish` (síncrono dentro da edge fn — adiciona latência)
**Opção B** — registrar evento e deixar `pg_cron` (1min) capturar (eventual consistency 0-60s, sem latência adicional)
**Opção C** — disparar via realtime trigger do `campaign_publications` (postgres trigger → `pg_net`)

**Recomendação:** **B**. Já há cron job `meta-sync` rodando — basta garantir que ele inclui campanhas recém-criadas (já inclui via `meta_ad_accounts.account_id` lookup).

---

## 3. Pesquisas necessárias para o design phase

| # | Item | Por quê |
|---|---|---|
| R1 | `compliance-officer` aceita dry-run sem persistir? | Decide se Decisão 3.A é viável ou só B serve |
| R2 | `campaign-publish` aceita imagem por signed URL com TTL curto? Ou precisa upload prévio pra `/{act_id}/adimages`? | Criativos gerados via `creative-generate` ficam em `creatives.media_url` (Supabase Storage signed). Confirmar que Meta aceita. |
| R3 | Como o `PublicationStatus` do CampaignPublisherView faz polling? Hook reutilizável? | Evita reinventar o polling p/ R4 |
| R4 | LLM gpt-4o consegue pré-popular targeting Meta confiavelmente do briefing? | Pode precisar few-shot ou validação Zod adicional no handler |

---

## 4. Implementation Approach Options (consolidado)

### Option A — Tudo extends/reusa (`approvals` + `InlineApprovalCard`)
- Esforço: **S (2-3 dias)**
- Risk: **Médio** — divergência semântica vai morder depois (Fase 4 vai querer renderizar diferente)

### Option B — Componente novo + tabela nova, padrões reusados
- Esforço: **M (4-6 dias)**
- Risk: **Baixo** — segue padrões estabelecidos, isolamento limpo

### Option C — Híbrido: tabela nova + card novo + REFATORA `compliance-runner` pra DRY
- Esforço: **M+ (5-7 dias)**
- Risk: **Baixo-Médio** — refator pequeno em código crítico (compliance) precisa testes

**Recomendação para o design phase:** **Opção C** modificada — tabela nova `campaign_proposals`, card novo `InlineCampaignProposalCard`, refator de compliance se confirmado em Pesquisa #1. Se #1 mostrar que `compliance-officer` aceita dry-run, fica Opção B pura.

---

## 5. Esforço & Risco totais

| Componente | Esforço | Risco |
|---|---|---|
| Migration `campaign_proposals` + RLS + trigger | S | Baixo |
| Tool `propose_campaign` handler + Zod | S | Baixo |
| Tool `publish_campaign` handler + invocação de `campaign-publish` | S | Baixo |
| Componente `InlineCampaignProposalCard` + Modal `CampaignProposalEditor` | M | Baixo |
| Hook `useCampaignProposals` (CRUD + realtime + polling de publication) | S | Baixo |
| System prompt v2 (glossário leigo + ordem de coleta) | S | Médio (qualidade do prompt) |
| Pre-check compliance (refatoração `compliance-runner` se necessário) | S-M | Médio |
| Telemetria + gate R10 + lookups Meta | S | Baixo |
| **Total** | **M (5-7 dias)** | **Baixo-Médio** |

---

## 6. Recomendações para o design phase

1. **Adotar Opção C** com confirmação de Pesquisa #1 e #2 antes de fechar o design final.
2. **Criar 1 nova migration** (`campaign_proposals`) — reusa convenções de `approvals` (RLS por `current_user_company_id()`, trigger de updated_at).
3. **Modularizar mapeamento** payload→`campaign-publish` body em `_shared/campaign-proposal-mapper.ts` pra testar isolado.
4. **Ordem de implementação sugerida** (pra validar incrementalmente):
   - (a) Migration + tipos
   - (b) Handler `propose_campaign` retornando markdown placeholder (sem card, validar via chat)
   - (c) Componente `InlineCampaignProposalCard` + hook + realtime
   - (d) Handler `publish_campaign` + polling
   - (e) System prompt v2
   - (f) Pre-check compliance
   - (g) Gates R10 + telemetria
5. **Itens explicitamente OUT OF SCOPE pro design**: persona-aware vocabulary por arquetipo (Fase 2), cron de relatório semanal (Fase 3), auto-otimização (Fase 4), preferência de page/account default na Integrations.
