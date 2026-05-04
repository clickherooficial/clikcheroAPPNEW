# Tasks — Multi-Agent Specialists

> 3 sprints incrementais. Cada sprint deploy + commit independente.
> Fast-track aprovado pelo usuario 2026-04-28.

## Sprint C0 — Helper compartilhado (CONCLUIDO 2026-04-28)

- [x] C0.1 — `supabase/functions/_shared/specialist-invoker.ts`
- [x] C0.2 — Refator ai-chat usa invokeSpecialist no delegate_to_meta_specialist
- [x] C0.3 — Build verde

## Sprint C1 — Creative Specialist (CONCLUIDO 2026-04-28)

- [x] C1.1 — `supabase/functions/creative-specialist/index.ts` (~280 linhas)
- [x] C1.2 — Tool delegate_to_creative
- [x] C1.3 — Case em executeTool
- [x] C1.4 — Prompt orchestrator atualizado
- [x] C1.5 — ORCHESTRATOR_TOOLS subset criado, 5 tools criativas removidas
- [x] C1.6 — Deploy
- [~] C1.7 — Smoke test manual — fora do closeout (decisão usuário 2026-05-02)
- [x] C1.8 — Commit ec1890a + push 3 remotes

## Sprint C2 — Compliance Officer (CONCLUIDO 2026-04-28)

- [x] C2.1 — `supabase/functions/compliance-officer/index.ts` (~270 linhas)
       com 3 tools + retorno de compliance_action
- [x] C2.2 — Tool delegate_to_compliance
- [x] C2.3 — Case com propagacao de compliance_action -> ref
- [x] C2.4 — Prompt orchestrator atualizado (secao COMPLIANCE)
- [x] C2.5 — 3 tools adicionadas em SPECIALIST_OWNED_TOOLS
- [x] C2.6 — Deploy
- [x] C2.7 — Build verde

## Sprint C3 — Action Manager (CONCLUIDO 2026-04-28)

- [x] C3.1 — `supabase/functions/action-manager/index.ts` (~270 linhas)
       com 6 tools (pause/reactivate ad/campaign + update_budget + propose_plan).
       NOTA: propose_rule continua no orchestrator (precisa userMessageId +
       attachmentIds pra feature de asset upload, fora de scope desta sprint).
- [x] C3.2 — Tool delegate_to_action
- [x] C3.3 — Case em executeTool
- [x] C3.4 — Prompt orchestrator atualizado (secao ACOES DESTRUTIVAS)
- [x] C3.5 — 6 tools adicionadas em SPECIALIST_OWNED_TOOLS
- [x] C3.6 — Deploy
- [x] C3.7 — Build verde

## Validacao geral

- [x] V1 — `npm run build` verde apos cada sprint
- [~] V2 — Telemetria agent_runs — fora do closeout (validação por uso real)
- [~] V3 — Latencia p50 — fora do closeout (validação por uso real)
- [~] V4 — Custo baseline — fora do closeout (validação por uso real)
- [x] V5 — Atualizar implemented-features.md (2026-05-02)
- [x] V6 — Commit final + push 3 remotes
