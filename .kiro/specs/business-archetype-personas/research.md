# Research Log — business-archetype-personas

> Última atualização: 2026-05-01
> Spec: `.kiro/specs/business-archetype-personas/`

## Summary

Discovery em modo **light** (extensão pequena de sistema brownfield maduro). Reusa briefing-onboarding (tabela existente), chat-publish-flow (BriefingResolver, CopyGenerator, system prompt), CerebroFuryView (tab Identidade já mostrando BriefingView). Único elemento novo backend: `archetype-detector` (pure heurística + fallback LLM opcional).

## Research Log

### R-01: Padrão de feature flag no projeto

**Investigação:** grep `Deno.env.get` em `_shared/`. Sem padrão centralizado de feature flag — env vars são lidas diretamente nos handlers (ex.: `ANTHROPIC_API_KEY`, `META_GRAPH_API_VERSION`).

**Achado:** Não há infraestrutura de flag formal (split.io, GrowthBook, etc). Convenção: `Deno.env.get('FLAG_NAME')` com fallback safe.

**Implicação:** R8.4 (`ENABLE_ARCHETYPE_PERSONAS`) implementa-se com env var simples. Default ON em prod (string ausente = ON). Pra desligar, setar literal `"false"`. Documentar em README/steering.

### R-02: Como o system prompt é montado hoje

**Investigação:** [supabase/functions/ai-chat/index.ts](supabase/functions/ai-chat/index.ts) consome `SYSTEM_PROMPT` de `_shared/prompt.ts` como string única. Composição é feita por concatenação (ex.: `briefingHint`, `briefingContext`).

**Achado:** Já existe pattern de "appends condicionais" (ex.: linhas 322 e 362). Adicionar bloco `<archetype:X>` segue o mesmo padrão.

**Implicação:** Em vez de incorporar 4 blocos hardcoded dentro do `SYSTEM_PROMPT` (que aumenta drasticamente o tamanho do prompt mesmo quando irrelevante), gerar o bloco como APPEND condicional. Apenas o bloco do arquétipo ativo entra no prompt. Economia: ~3000 tokens em cada chamada.

### R-03: Estrutura da BriefingView e tab Identidade

**Investigação:** [src/components/CerebroFuryView.tsx:115](src/components/CerebroFuryView.tsx#L115) renderiza `<BriefingView />` na tab Identidade. BriefingView (componente existente do briefing-onboarding) é o ponto natural pra colocar o seletor de arquétipo.

**Achado:** Há um padrão estabelecido de seções colapsáveis (Accordion) dentro de BriefingView pra editar campos do briefing.

**Implicação:** Adicionar `<ArchetypeSelector />` como uma das seções do BriefingView, lendo/escrevendo via hook existente `useBriefing` (estendido com `business_archetype`).

### R-04: Quickstart cards atuais

**Investigação:** [src/components/ChatView.tsx](src/components/ChatView.tsx) renderiza 4 cards estáticos no welcome (`messages.length === 0`).

**Achado:** Os cards são literais TSX hardcoded. Sem fonte de dados externa.

**Implicação:** Substituir por mapa estático `QUICKSTART_BY_ARCHETYPE: Record<Archetype | 'fallback', QuickstartCard[]>` lido em render. Sem mudança de schema, sem fetch — render condicional puro.

### R-05: Reuso do CopyGenerator/BriefingResolver da Fase 1

**Investigação:** [campaign-proposal-helpers.ts](supabase/functions/_shared/campaign-proposal-helpers.ts) tem mapas estáticos `OBJECTIVE_BY_FORMAT` e `OPTIMIZATION_BY_OBJECTIVE`.

**Achado:** Pra estender por arquétipo basta adicionar mapa paralelo `OBJECTIVE_BY_ARCHETYPE` que tem precedência sobre `OBJECTIVE_BY_FORMAT` quando arquétipo está setado. CopyGenerator também aceita `archetype` no input pra ajustar prompt do gpt-4o.

**Implicação:** Mudança não-breaking. Quando archetype=NULL, comportamento Fase 1 preservado integralmente.

### R-06: detectArchetype — heurística vs LLM

**Investigação:** Lookup em comunidade (Meta Ads de pequenos anunciantes BR) sugere keywords muito comuns por arquétipo:

- **small_local_business**: "padaria", "mercearia", "loja de ", "restaurante", "barbearia", "salão", "açougue", "pet shop", "farmácia local", "lanchonete"
- **online_seller**: "loja virtual", "e-commerce", "shopify", "nuvemshop", "drop", "loja online", "site de", "marketplace"
- **service_provider**: "advogado", "eletricista", "encanador", "dentista", "psicólogo", "estética", "reparo", "manutenção", "serviço de"
- **info_product**: "curso", "treinamento", "mentoria", "aula", "método", "ebook", "workshop", "coaching", "consultoria online"

**Achado:** Heurística cobre ~80% dos casos típicos. LLM fallback resolve os 20% (negócios híbridos, nicho atípico). Custo gpt-4o-mini com 100 tokens output = ~$0.0001 por classificação — desprezível.

**Implicação:** Usar gpt-4o-mini (não gpt-4o full) pra classificação — barato e suficiente. Prompt curto: "Classifique este negócio em UM dos 4: small_local_business, online_seller, service_provider, info_product. Negócio: {niche}, {short_description}. Retorne só o valor JSON."

### R-07: Backfill — estratégia de execução

**Investigação:** Projeto usa `pg_cron` em alguns casos (knowledge-base, etc.) e Edge Functions one-shot em outros. R7.1 pede "job/script idempotente".

**Achado:** Edge Function one-shot acionada manualmente via `curl` (ou cron de uma vez só) é o padrão mais leve. Não precisa pg_cron permanente — backfill é one-shot.

**Implicação:** Criar Edge Function `archetype-backfill` que: itera company_briefings WHERE status='complete' AND business_archetype IS NULL, processa em lotes de 10, com sleep de 6s entre lotes (rate limit conservador). Idempotente: skipa rows que já têm valor (R2.5).

## Architecture Pattern Evaluation

| Opção | Adotada? | Motivo |
|---|---|---|
| A — Hardcoded if/else dentro de cada handler | ❌ | 4× duplicação de lógica; difícil adicionar 5º arquétipo |
| B — Strategy pattern com `Archetype` interface + 4 implementações | ❌ | Over-engineering pra 4 estratégias estáticas |
| C — Mapas estáticos `Record<Archetype, T>` por concern (objective, copy_template, prompt_block) | ✅ | DRY, fácil adicionar arquétipo, tipado em TS |

**Adotada: Opção C** — mapas estáticos por concern, com fallback genérico quando archetype é NULL.

## Design Decisions

| # | Decisão | Tradeoff |
|---|---|---|
| D1 | Coluna `business_archetype` em `company_briefings` (não nova tabela) | +ALTER em tabela existente; -1 join evitado |
| D2 | NULL = comportamento Fase 1 (sem arquétipo) — fallback genérico | +Compatibilidade total; -lógica `if (archetype) { ... } else { ... }` em vários pontos |
| D3 | Detecção via heurística first, LLM (gpt-4o-mini) fallback | +Custo desprezível; -dependência de OpenAI key |
| D4 | System prompt: append condicional do bloco `<archetype:X>`, NÃO embedding 4 blocos hardcoded | +3000 tokens economizados/chamada; -lógica de composição extra |
| D5 | Quickstart cards: mapa estático no front (sem RPC) | +Simples; -se mudar texto precisa redeploy |
| D6 | Backfill via Edge Function one-shot (não pg_cron) | +Leve; -roda manualmente |
| D7 | Feature flag via env var `ENABLE_ARCHETYPE_PERSONAS` (default ON) | +Kill switch sem rollback; -gerenciamento manual de env |
| D8 | Settings UI: seletor inline em BriefingView, auto-save | +UX consistente com resto do briefing; -sem confirmação de mudança |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Heurística classificar errado por keyword overlap (ex: "loja de roupa" pode ser local OU online) | Médio | Fallback LLM resolve; usuário pode editar manualmente em Settings |
| Quickstart cards condicionais quebrarem layout em mobile | Baixo | Manter mesmo grid 1col mobile/2col desktop; testar 4 conjuntos |
| Token explosion no system prompt se subir pra 8 arquétipos | Baixo | Pattern de append condicional escala linearmente; 1 bloco/req |
| Backfill saturar API OpenAI ou bloquear DB | Baixo | Lotes de 10, sleep 6s; consulta com LIMIT |
| Usuário não entender "arquétipo" no Settings | Médio | Labels em PT leigo + 1 frase descritiva por opção (R3.2) |

## Open Questions (deferred to design)

- Mapa exato de keywords por arquétipo (decidir lista final no spec-tasks ou no PR de implementação)
- Texto exato dos 4 blocos `<archetype:X>` do system prompt v3 (escrever no PR de implementação — design só fixa estrutura)
- Quickstart cards: 3 ou 4 por arquétipo? Vou sugerir 4 (consistência com hoje), revisitar pós-uso
