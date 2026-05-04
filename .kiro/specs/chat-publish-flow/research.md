# Research Log — chat-publish-flow

> Última atualização: 2026-05-01
> Spec: `.kiro/specs/chat-publish-flow/`

## Summary

Discovery em modo **light** (extensão de sistema brownfield com infra ~80% pronta). 4 pesquisas pendentes do gap analysis foram resolvidas via grep do código. Decisões fixadas no design.

## Research Log

### R-01: `compliance-officer` aceita dry-run?

**Investigação:** [compliance-officer/index.ts:296](supabase/functions/compliance-officer/index.ts#L296), [data-fetchers.ts:537](supabase/functions/_shared/data-fetchers.ts#L537).

**Achado:** NÃO há flag `dry_run`. A tool `rescan_compliance({mode: 'active_only'|'all'})` opera sobre **criativos ATIVOS já no DB** — não serve pra checar uma proposta em rascunho.

**Implicação:** A pré-checagem do card (R7) precisa de outra abordagem. Decisão: extrair `runComplianceCheck(headline, body, image_url)` de [campaign-publish/index.ts:110-206](supabase/functions/campaign-publish/index.ts#L110-L206) para módulo compartilhado `_shared/compliance-runner.ts`. Reusada por (a) handler `propose_campaign` e (b) próprio `campaign-publish` (mesmo gate definitivo).

### R-02: Meta API aceita signed URL Supabase como `image_url`?

**Investigação:** [campaign-publish/index.ts:56](supabase/functions/campaign-publish/index.ts#L56) (Zod aceita URL), :163 (fetch+base64 pra compliance), :629 (envia como `object_story_spec.link_data.picture`).

**Achado:** A Meta Marketing API aceita `picture` como URL pública. `campaign-publish` JÁ baixa a imagem (signed URL → fetch → base64) pra rodar compliance ANTES de mandar a URL pra Meta. Signed URLs do Supabase com TTL ≥10min funcionam (latência típica do flow é <60s).

**Implicação:** Reusar `creative.media_url` direto. Garantir que o signed URL gerado pelo handler tenha TTL ≥15min pra cobrir aprovação humana lenta + retry.

### R-03: Hook de polling do `PublicationStatus` é reutilizável?

**Investigação:** [PublicationStatus.tsx:27](src/components/publisher/PublicationStatus.tsx#L27) usa `useCampaignPublication(publicationId)` de `use-campaign-publisher`.

**Achado:** Hook genérico já existente. Aceita `publicationId`, retorna `{data: {status, current_step, name, ...}, isLoading}`. **REUSAR direto** no `InlineCampaignProposalCard`.

**Implicação:** Zero duplicação de lógica de polling. Card chama `useCampaignPublication(publication_id)` quando status passa pra `publishing`.

### R-04: gpt-4o pré-popula targeting Meta confiavelmente do briefing?

**Investigação:** Briefing armazena `audience` jsonb com `{ageRange, location, interests[], behaviors[]}`. Schema Meta exige campos específicos (`age_min`, `age_max`, `geo_locations.cities[]`, `interests[]` com FB IDs).

**Achado:** Risco de drift. Interesses Meta exigem **IDs do Facebook** (não strings livres). Lookup via Targeting Search API existe mas não está integrado.

**Implicação (mitigação):**
- v1: targeting básico apenas com `age_min/max` (do `ageRange`) + `geo_locations.countries=['BR']` (default). Interests omitidos do auto-pré-preenchimento — agente pergunta no chat e usuário aceita ou ignora.
- v2 (out of scope desta spec): integrar Targeting Search API e mapear `briefing.audience.interests` (strings) → IDs Meta.
- Validação Zod no handler aborta se schema Meta não for satisfeito.

## Architecture Pattern Evaluation

| Opção | Adotada? | Motivo |
|---|---|---|
| A — Reusar `approvals` table + `InlineApprovalCard` | ❌ | Diverge semântica (proposta editável + polling pós-pub vs. aprovação atômica) |
| B — Tabela nova + componente novo | ✅ | Cleanup boundary, pattern HITL preservado mas adaptado |
| C — Híbrido com refator de `compliance-runner` | ✅ (combinado com B) | R-01 confirmou necessidade do refator |

## Design Decisions

| # | Decisão | Tradeoff aceito |
|---|---|---|
| D1 | Tabela nova `campaign_proposals` (não reusar `approvals`) | +1 migration; -semantic confusion |
| D2 | Refatorar `runComplianceCheck` → `_shared/compliance-runner.ts` | +touch em código crítico (precisa testes); -DRY violation |
| D3 | Múltiplas pages: heurística "primeiro ativo" + fallback chat | UX pior se >1; setting de default fica fora |
| D4 | `meta-sync` pós-live via cron existente (não trigger) | Eventual consistency 0-60s; -latência adicional |
| D5 | Targeting v1: só age + país | Interests vão ficar genéricos; v2 resolve |
| D6 | Reusar `useCampaignPublication` do publisher view | Zero novo código de polling |
| D7 | Image URL: signed Supabase com TTL 15min | Risco baixo de expiração mid-flow |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Prompt v2 não convencer LLM a chamar `propose_campaign` na hora certa | Médio | Tool description forte + few-shot no system prompt + telemetria de drift |
| Signed URL expira antes do user aprovar | Baixo | TTL 15min + handler recalcula URL no momento de publicar |
| Compliance check refatorado quebra `campaign-publish` existente | Médio | Testes unitários + smoke test e2e antes de deploy |
| Conta Meta com >1 page ativa: heurística "primeiro" pega a errada | Médio | Fallback: agente lista nomes amigáveis e pergunta |
| `meta-sync` demorar >60s pra capturar campanha nova | Baixo | UX: card já mostra "live" + link "Ver no Meta Ads Manager" como fallback |

## Open Questions (deferred)

- O `expires_at` do `campaign_proposals` deve ser igual ao `approvals` (ex: 1h)? — sugestão: 24h, pois proposta é doc, não ação atômica
- Quando o usuário **edita** a proposta, geramos nova linha (versionamento) ou UPDATE in-place? — sugestão: UPDATE in-place pra simplicidade; auditoria via `agent_runs`
