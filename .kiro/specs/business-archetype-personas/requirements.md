# Requirements Document

## Project Description (Input)
business-archetype-personas

Adicionar suporte a "arquétipos de negócio" no Agente HERO pra que o tom de voz, sugestões e defaults sejam adaptados automaticamente ao tipo de negócio do usuário (mercearia, e-commerce online, prestador de serviço, infoproduto). Estende o que a Fase 1 (chat-publish-flow) já fez: system prompt v2 hoje tem defaults só pra "negocio físico local"; aqui generalizamos pra 4 arquétipos com vocabulário, exemplos e CTAs específicos.

Contexto: o briefing-onboarding já coleta `niche` (texto livre) e `niche_category` (texto livre). Falta:

1) Coluna nova `business_archetype` em company_briefings (enum: small_local_business | online_seller | service_provider | info_product), preenchida automaticamente via heurística (LLM ou keyword match na primeira passagem) E editável pelo usuário no settings.

2) System prompt v3: blocos condicionais de voz por arquetipo (ex.: small_local_business → mencionar bairro/cidade, sugerir engagement; online_seller → mencionar promo/cupom, sugerir sales+pixel; service_provider → mencionar agendamento/contato, sugerir leads+messaging; info_product → mencionar transformação/aula gratis, sugerir leads+webinar).

3) Cards de quickstart no welcome do chat condicionais ao arquetipo (hoje são 4 fixos genéricos): pra mercearia mostraria "Quero promover oferta da semana", "Quero divulgar para o meu bairro"; pra info_product mostraria "Quero capturar leads pra meu curso", "Quero divulgar minha aula gratuita".

4) Defaults de propose_campaign condicionais (estende BriefingResolver da Fase 1): ajusta objective, targeting, copy boilerplate por arquetipo.

Persona-alvo: continuar atendendo Pedro (padaria) mas também Maria (e-commerce de bijuteria), João (eletricista) e Ana (curso online de doces). Cada um quer ver linguagem e atalhos que falam com SEU contexto.

Stack: React + Supabase Edge Functions + OpenAI gpt-4o já em uso. Tabela company_briefings já existe (briefing-onboarding). Adicionamos coluna ALTER + lógica condicional nos handlers/prompt.

Fora de escopo desta spec: detecção automática de arquetipo via crawler de website (Fase 3+); novo wizard de onboarding por arquetipo (UX redesign separado); briefings proativos diários (Fase 3 do roadmap original); loop de auto-otimização (Fase 4).

## Introduction

Hoje o Agente HERO trata todos os usuários com a mesma voz e os mesmos atalhos genéricos, com exceção de uma única ramificação no system prompt v2 (defaults pra "negocio físico local"). Pra que **Pedro** (padaria), **Maria** (e-commerce de bijuteria), **João** (eletricista) e **Ana** (curso online) sintam que o agente "fala a língua deles", precisamos de **4 arquétipos de negócio formais** que personalizam:

- Vocabulário no chat (jargão, exemplos, perguntas)
- Quickstart cards no welcome (atalhos contextuais)
- Defaults da proposta de campanha (objective, targeting, copy boilerplate)

A coluna `business_archetype` em `company_briefings` é a fonte da verdade. É preenchida **automaticamente** ao final do briefing-onboarding (via heurística leve sobre `niche`/`niche_category`/`primary_offer.format`) e **editável** pelo usuário no Settings ([CerebroFuryView Identidade]). Tudo que depende do arquétipo lê dessa coluna; nada hardcoded.

Sucesso = ao logar com briefing completo, quickstart cards e tom do agente refletem o arquétipo correto sem o usuário ter feito nada extra.

## Requirements

### Requirement 1: Coluna `business_archetype` em company_briefings

**Objective:** Como dev/sistema, quero uma coluna estruturada de arquétipo no briefing pra que toda lógica condicional (prompt, cards, defaults) leia uma única fonte de verdade.

#### Acceptance Criteria
1. The data model shall adicionar coluna `business_archetype text` em `public.company_briefings` com CHECK in (`small_local_business`, `online_seller`, `service_provider`, `info_product`).
2. The data model shall permitir NULL na coluna (briefings antigos sem arquétipo detectado seguem funcionando — handlers fazem fallback genérico).
3. While o briefing existe sem `business_archetype` setado, the Briefing Service shall tratar como "genérico" e usar as defaults atuais (sem quebrar nada da Fase 1).
4. The data model shall criar índice parcial em `(company_id) WHERE business_archetype IS NOT NULL` apenas se houver query frequente — caso contrário omitir (seguir convenção do projeto: não over-index).
5. The migration shall ser ADITIVA (sem ALTER em colunas existentes, sem DROP), seguindo SAFETY_PROTOCOL do projeto.

### Requirement 2: Detecção automática inicial do arquétipo

**Objective:** Como Pedro/Maria/João/Ana, quero que o sistema entenda meu tipo de negócio a partir do que eu já preenchi no briefing, pra eu não precisar responder mais uma pergunta.

#### Acceptance Criteria
1. When o briefing é completado pela primeira vez (`company_briefings.status` transiciona pra `complete`) AND `business_archetype IS NULL`, the Briefing Service shall invocar `detectArchetype()` que recebe `{ niche, niche_category, primary_offer.format, primary_offer.short_description, website_url }` e retorna um dos 4 valores ou null.
2. The detectArchetype function shall usar heurística determinística primeiro (keyword match em listas curadas: "padaria/mercearia/loja/restaurante" → small_local_business; "loja virtual/e-commerce/shopify" → online_seller; "curso/treinamento/mentoria/aula/método" → info_product; "advogado/eletricista/encanador/dentista/serviço de" → service_provider).
3. If heurística não bater (zero match em todas as listas), the detectArchetype function shall opcionalmente invocar gpt-4o com prompt de classificação curto (max 100 tokens output) que retorna um dos 4 valores em JSON.
4. While `detectArchetype` retornar valor não-null, the Briefing Service shall fazer UPDATE da coluna `business_archetype` no mesmo briefing.
5. The detectArchetype shall ser idempotente: se já existe valor, NÃO sobrescreve (respeita escolha manual do usuário).
6. If detectArchetype falhar (timeout, JSON inválido, sem API key), the Briefing Service shall deixar a coluna NULL e logar warning — sem bloquear conclusão do briefing.

### Requirement 3: Edição manual do arquétipo no Settings

**Objective:** Como usuário cuja heurística errou (ou quer testar voz diferente), quero poder mudar meu arquétipo no Settings sem chamar suporte.

#### Acceptance Criteria
1. The Settings UI (CerebroFuryView, aba Identidade) shall exibir um seletor com 4 opções traduzidas pra PT leigo: "Comércio físico local", "Loja online (e-commerce)", "Prestador de serviço", "Curso/conteúdo digital".
2. The Settings UI shall mostrar 1 frase descritiva por arquétipo embaixo da opção pra ajudar o usuário a escolher (ex.: "Padaria, restaurante, salão, mercearia — atende quem mora perto").
3. When o usuário troca o arquétipo no select, the Settings UI shall fazer UPDATE imediato em `company_briefings.business_archetype` (sem botão Salvar — auto-save com toast de confirmação).
4. The Settings UI shall mostrar uma 5ª opção "Não sei / Misto" que seta a coluna para NULL (volta ao comportamento genérico).

### Requirement 4: System prompt v3 — blocos condicionais por arquétipo

**Objective:** Como cada usuário-persona, quero que o agente fale com vocabulário, exemplos e sugestões que façam sentido pro meu negócio.

#### Acceptance Criteria
1. The Orchestrator system prompt shall conter 4 blocos modulares (`<archetype:small_local_business>...</archetype>`, etc.) injetados condicionalmente conforme `business_archetype` do tenant ativo.
2. While `business_archetype = 'small_local_business'`, the Orchestrator system prompt shall enfatizar: mencionar bairro/cidade no copy, sugerir objective ENGAGEMENT ou TRAFFIC, exemplos com "vizinhos" e "quem passa na rua", evitar jargão de pixel/funil.
3. While `business_archetype = 'online_seller'`, the Orchestrator system prompt shall enfatizar: mencionar promoção/cupom/frete, sugerir objective SALES, exemplos com "carrinho abandonado" e "primeira compra", recomendar instalar Pixel se não tiver.
4. While `business_archetype = 'service_provider'`, the Orchestrator system prompt shall enfatizar: agendamento por WhatsApp, sugerir objective LEADS com CTA WHATSAPP_MESSAGE quando disponível, exemplos com "primeiro orçamento" e "atendimento na sua casa".
5. While `business_archetype = 'info_product'`, the Orchestrator system prompt shall enfatizar: transformação/resultado, sugerir objective LEADS com aula gratuita ou e-book, exemplos com "lista de espera" e "alunos que já fizeram", evitar promessas exageradas.
6. While `business_archetype IS NULL`, the Orchestrator system prompt shall usar texto neutro (sem nenhum dos 4 blocos) — comportamento atual da Fase 1 preservado.
7. The Orchestrator shall ler o arquétipo do tenant ANTES de montar o system prompt (na entrada do request, após resolver companyId).

### Requirement 5: Quickstart cards condicionais no welcome do chat

**Objective:** Como usuário que abre o chat pela primeira vez no dia, quero ver atalhos que reflitam o que faz sentido pro meu tipo de negócio, pra começar mais rápido.

#### Acceptance Criteria
1. While `messages.length === 0` (welcome state) AND `business_archetype IS NOT NULL`, the ChatView shall renderizar um conjunto de **3-4 quickstart cards específicos do arquétipo** em vez dos 4 fixos atuais.
2. While `business_archetype = 'small_local_business'`, the ChatView shall mostrar quickstart com: "Quero promover oferta da semana", "Quero divulgar para o meu bairro", "Quero atrair mais clientes no fim de semana", "Como tá meu anúncio que tá rodando?".
3. While `business_archetype = 'online_seller'`, the ChatView shall mostrar quickstart com: "Quero anunciar uma promoção", "Quero recuperar carrinho abandonado", "Crie um anúncio pro produto X", "Como tá a conversão da loja?".
4. While `business_archetype = 'service_provider'`, the ChatView shall mostrar quickstart com: "Quero atrair mais clientes pra orçamento", "Anúncio focado em WhatsApp", "Divulgar serviço na minha região", "Quanto custa cada contato que recebi?".
5. While `business_archetype = 'info_product'`, the ChatView shall mostrar quickstart com: "Quero capturar leads pra meu curso", "Divulgar minha aula gratuita", "Crie um anúncio com depoimento", "Quanto pago por cada lead?".
6. While `business_archetype IS NULL`, the ChatView shall manter os 4 quickstart cards genéricos atuais (compatibilidade retroativa).
7. The Quickstart cards shall, ao serem clicados, enviar o prompt customizado correspondente pra `sendMessage()` — mesmo padrão dos atuais.

### Requirement 6: Defaults condicionais no `propose_campaign` (BriefingResolver)

**Objective:** Como usuário-persona, quero que a proposta de campanha gerada pelo agente já venha com objective/targeting/copy que façam sentido pro meu arquétipo, sem eu ter que editar tudo.

#### Acceptance Criteria
1. The BriefingResolver (resolveDefaults) shall ler `business_archetype` do briefing e ajustar defaults condicionalmente.
2. While `business_archetype = 'small_local_business'`, the BriefingResolver shall preferir objective `TRAFFIC` (default Fase 1 era SALES pra `physical`); manter age range; copy boilerplate inclui "aqui no [bairro/cidade]" se cidade conhecida.
3. While `business_archetype = 'online_seller'`, the BriefingResolver shall preferir objective `SALES` com optimization_goal `CONVERSIONS`; copy boilerplate inclui call-to-action de compra clara ("Garanta o seu", "Aproveite agora").
4. While `business_archetype = 'service_provider'`, the BriefingResolver shall preferir objective `LEADS` com CTA `CONTACT_US` (ou WHATSAPP_MESSAGE quando disponível); copy boilerplate inclui menção a orçamento sem compromisso.
5. While `business_archetype = 'info_product'`, the BriefingResolver shall preferir objective `LEADS` com CTA `SIGN_UP`; copy boilerplate menciona aula/material gratuito.
6. The CopyGenerator shall receber o `business_archetype` no input e ajustar o system prompt do gpt-4o pra refletir o tom do arquétipo.
7. While o usuário passa `objective` explícito como override, the BriefingResolver shall respeitar o override (não sobrescrever com default do arquétipo).
8. While `business_archetype IS NULL`, the BriefingResolver shall manter exatamente os defaults atuais da Fase 1 (compatibilidade retroativa).

### Requirement 7: Backfill e auditoria

**Objective:** Como time/admin, quero saber quantos tenants já têm arquétipo detectado e quantos seguem sem, pra medir cobertura da heurística.

#### Acceptance Criteria
1. The migration shall incluir um job/script (idempotente) que percorre `company_briefings` existentes com `status='complete'` e invoca `detectArchetype()` em batch — populando os retroativos sem requerer ação do usuário.
2. The backfill shall ter rate limit conservador (max 10 calls/min se LLM ativo) e logar cada classificação em `agent_runs` com `agent_name='archetype-detector'`.
3. The system shall expor uma view ou query simples que conte tenants por arquétipo (pra dashboard interno) — sem precisar UI dedicada nesta spec.

### Requirement 8: Telemetria e fallback

**Objective:** Como time/admin, quero medir se a personalização realmente muda comportamento (taxa de clique em quickstart, taxa de aprovação de propose_campaign por arquétipo), pra validar a hipótese.

#### Acceptance Criteria
1. The ChatView shall logar (em `agent_runs.metadata` ou tabela separada simples) qual arquétipo estava ativo quando um quickstart card foi clicado.
2. The propose_campaign handler shall incluir o `business_archetype` no `metadata` do `agent_runs` quando invocar a tool.
3. If a deteção falhar consistentemente para um tenant (3 tentativas de backfill resultando em null), the system shall registrar isso em log mas NUNCA bloquear o usuário — fallback para comportamento genérico é sempre seguro.
4. The system shall permitir feature flag (env var `ENABLE_ARCHETYPE_PERSONAS`) pra desabilitar todo o sistema globalmente caso surjam regressões — sem precisar rollback de migration.
