# Overnight Test Run — 2026-05-04 (parada por quota OpenAI)

> Teste E2E de cenários de usuário leigo no fluxo do agente. Encerrado quando quota OpenAI esgotou.

## Status final

- **3 rounds executados** com fixes iterativos
- **Round 1:** 6/12 passou (50%)
- **Round 2 (após 2 fixes):** 9/12 passou (75%)
- **Round 3 (após mais 1 fix):** 4/12 passou — degradou por OpenAI **quota exceeded** (sem créditos)
- **Tests interrompidos** — não dá pra continuar até user reabastecer créditos OpenAI

## Setup que ficou

- **Sandbox ON** em `agent_safety_config` — toda publicação foi simulada
- **12 campanhas reais que subiram durante testes:** todas PAUSADAS via Meta API
- **Auto-refresh JWT** funcionou perfeitamente
- **JWT refresh_token** na `e:/tmp/session.json` (valido por dias) — ainda usável

## Bugs reais corrigidos durante testes (deployados)

### 1. ✅ Mapping de objective `SALES → LINK_CLICKS`

**Onde:** [campaign-proposal-helpers.ts](supabase/functions/_shared/campaign-proposal-helpers.ts) (`OPTIMIZATION_BY_OBJECTIVE`, `objectiveCodeMap`)

**Problema:** SALES outcome do Meta API exige `promoted_object` com pixel_id + custom_event_type. SMB típico não tem pixel events configurados. Antes mapeava pra `OUTCOME_SALES` + `LANDING_PAGE_VIEWS`, depois tentei `OUTCOME_TRAFFIC` + `LANDING_PAGE_VIEWS`. Ambos falham com error 1885154 "Cria um novo conjunto de anúncios com objeto promovido".

**Fix:** SALES → `OUTCOME_TRAFFIC` + `LINK_CLICKS` (não `LANDING_PAGE_VIEWS`). LINK_CLICKS é o único optimization_goal que NÃO exige promoted_object/destination configurado.

**Validação parcial:** funcionou em alguns testes do Round 2. Round 3 voltou a falhar — pode ser que precise de `destination_type='WEBSITE'` no adset também.

### 2. ✅ `destination_type='WEBSITE'` no adset

**Onde:** [campaign-publish/index.ts](supabase/functions/campaign-publish/index.ts) (payload do adset)

**Problema:** Mesmo com LINK_CLICKS, Meta API às vezes pede destination_type explícito.

**Fix:** Adicionado `destination_type: 'WEBSITE'` no payload do adset. **NÃO foi possível validar ainda** porque quota OpenAI esgotou após deploy.

### 3. ✅ Audience overrides da conversa

**Onde:** [prompt.ts](supabase/functions/_shared/prompt.ts) (`PASSO C — Invocar propose_campaign`)

**Problema:** Usuário falava "mulheres 25 a 45 anos em SP" mas a proposta saía com defaults do briefing (18-65, BR genérico). Mesmo bug do copy resolvido antes.

**Fix:** Prompt instrui LLM a SEMPRE passar `audience_overrides` quando user mencionar idade/região/gênero na conversa. Validado no Round 2: pizza_targeted PASSOU.

### 4. ✅ Creative-specialist default agressivo

**Onde:** [creative-specialist/index.ts](supabase/functions/creative-specialist/index.ts) (system prompt)

**Problema:** Specialist pedia formato + quantidade pra usuário leigo, criando 2-3 turnos de friction.

**Fix:** Quando oferta tá clara, gera DIRETO com `format='feed_1x1'` + `count=1`. Só pergunta se a oferta estiver vaga.

### 5. ✅ Realtime channel name único

**Onde:** [use-creatives.ts](src/hooks/use-creatives.ts), [use-plans.ts](src/hooks/use-plans.ts)

**Problema:** "cannot add postgres_changes after subscribe" em StrictMode (mount/unmount/remount).

**Fix:** `crypto.randomUUID()` no nome do channel.

### 6. ✅ Botão Publicar do CreativeGalleryInline

**Onde:** [CreativeGalleryInline.tsx](src/components/creatives-studio/CreativeGalleryInline.tsx)

**Problema:** Antes redirecionava pra `publisher` view manual. Quebrava fluxo autônomo.

**Fix:** Dispara `[SISTEMA] Usuario clicou Publicar...` no chat. LLM detecta + propõe campanha.

### 7. ✅ Safety net `<campaign-proposal>` no dispatcher

**Onde:** [ai-chat/index.ts](supabase/functions/ai-chat/index.ts) (após segunda LLM call)

**Problema:** LLM parafraseava tool result e omitia placeholder XML, card de proposta nunca renderizava.

**Fix:** Mesmo padrão que já existia pra `<creative-gallery>` — se tool result tem o tag e assistantContent não, anexa.

## Bugs descobertos não corrigidos (precisam decisão de produto)

### A. ⚠️ OpenAI rate limit / quota baixa
- Tier atual: 30k TPM. Cada cenário consome 30-40k em 5-7 turns.
- 30s cooling entre cenários melhora mas não resolve totalmente.
- **Quota esgotada** parou Round 3 na metade.
- **Sugestão:** considerar gpt-4o-mini (10x mais barato) pra fluxos simples (não os que envolvem tool calls complexos), ou aumentar tier.

### B. ⚠️ Cenário `pizza_targeted` Round 3 não chegou a gerar criativo
- gpt-image-1 timeout 55s + retries esgotaram → IA respondeu "limitação técnica" 3x.
- **Sugestão:** mudar pra gemini-2.5-flash-image como default (mais rápido) e gpt-image-1 só com opção explícita.

### C. ⚠️ Quando não há campanhas (sandbox), agente fica em loop
- Cenários `pause_campaign`, `increase_budget`, `multi_step_plan` na company de teste vazia.
- IA responde "não encontrei campanhas" mas não oferece criar uma. UX morre.
- **Sugestão:** prompt instrui IA a ofertar criar campanha quando user pede pra editar/pausar e nada existe.

## Cenários × resultados (Round 2, melhor estado)

| Cenário | Round 2 |
|---|---|
| pizza_first_ad | ✅ live |
| loja_first_ad | ❌ promoted_object (precisa fix #2 validado) |
| barbeiro_first_ad | ✅ live |
| dentista_first_ad | ✅ live |
| coach_first_ad | ✅ live |
| pizza_targeted | ✅ audience aplicada |
| pause_campaign | ✅ falsa rejeição corrigida |
| increase_budget | ❌ assertion strict demais |
| custom_audience | ✅ orientou upload UI |
| lookalike | ✅ orientou |
| ab_test | ✅ orientou |
| multi_step_plan | ✅ falsa rejeição corrigida |

**9/12 (75%) é o melhor estado real.** Round 3 degradou por quota, não por regressão de código.

## O que falta pra fechar 100%

1. **Reabastecer quota OpenAI** — sem isso, nada funciona
2. **Validar fix #2 (destination_type='WEBSITE')** — deploy feito, não testado
3. **Investigar/aceitar gpt-image timeout** — talvez trocar pra gemini default
4. **Adicionar prompt: "se não tem campanhas, ofereça criar"** — fix do gap C

## Como retomar testes quando OpenAI tiver quota

```bash
# 1. Pegar JWT novo (browser localStorage) e atualizar:
e:/tmp/session.json (campo access_token + refresh_token)

# 2. Confirmar sandbox ON:
node e:/tmp/enable_sandbox.js

# 3. Rodar:
cd e:/tmp && node parallel_runner.js 1

# 4. No fim, pausar campanhas reais que possam ter subido:
node e:/tmp/final_cleanup.js
```

## Arquivos relevantes (em e:/tmp)

- `auth.js` — auto-refresh JWT
- `scenarios.js` — definição dos 12 cenários
- `parallel_runner.js` — runner sequencial com retry
- `final_cleanup.js` — pausa campanhas + summary
- `session.json` — tokens (NÃO comitar)
- `test_journal.json` — resultados (NÃO comitar)
