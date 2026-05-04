# Requirements Document

## Project Description (Input)
chat-publish-flow

Permitir que o usuário leigo (ex.: dono de padaria/mercearia) publique uma campanha completa no Meta Ads diretamente pelo chat com o Agente HERO, sem precisar abrir o Publisher view nem o Meta Ads Manager.

Contexto: a edge function `campaign-publish` já existe e cria campanhas reais nos 4 níveis (campaign+adset+creative+ad) com rollback e compliance gate. O orchestrator `ai-chat` tem 30+ tools mas nenhuma faz a ponte com `campaign-publish`. O `creative-specialist` já gera imagens via IA (signed URLs no Supabase Storage). Falta:

1) Tool `propose_campaign` no orchestrator: o agente coleta conversacionalmente os campos (objetivo, budget, audience, copy) — pré-preenche da briefing/oferta principal — e renderiza um card de proposta inline (estilo `InlineApprovalCard`) com o resumo completo do que vai pro Meta.

2) Tool `publish_campaign(proposal_id)`: aprovação do card invoca `campaign-publish` reusando ad_account, page_id e pixel_id já conectados via OAuth. Imagem é a URL signed do criativo gerado.

3) System prompt v2 do orchestrator: depois de gerar imagem com sucesso, agente AUTOMATICAMENTE propõe a campanha (não fica esperando o usuário pedir "ok publica"). Vocabulário guiado pra leigo: "anúncio que vai rodar no Facebook/Instagram", "quanto você quer investir por dia".

4) Status pós-publicação: card mostra evolução (publishing → live | failed) com polling, igual o Publisher view atual. Em caso de erro, agente sugere reabrir/iterar.

Persona-alvo: Pedro, dono de padaria, nunca usou Meta Ads Manager, fala português coloquial. Sucesso = ele consegue publicar em < 5 turns de chat depois da imagem gerada.

Stack: React + TanStack Query + Supabase Edge Functions (Deno) + OpenAI gpt-4o (orchestrator) + Meta Marketing API v23.0 já integrada. UI: shadcn/ui + Tailwind. Idioma: pt-BR.

Fora de escopo desta spec: persona-aware language por arquetipo de negócio (Fase 2), briefings proativos diários (Fase 3), loop de otimização auto (Fase 4).

## Introduction

A feature **chat-publish-flow** estende o orchestrator `ai-chat` com a capacidade de levar o usuário leigo do "tenho um criativo gerado" até o "campanha rodando no Meta" sem sair do chat. Hoje o `campaign-publish` é uma Edge Function plenamente funcional que só pode ser invocada via UI do Publisher (3 passos manuais com formulários técnicos). Esta spec adiciona uma **ponte conversacional**: o agente coleta os dados restantes, mostra um cartão-resumo inline (mesmo padrão dos approvals), e ao receber aprovação humana invoca `campaign-publish` com os dados completos, refletindo o status (publishing → live | failed) de volta ao chat.

O sucesso da feature é medido por **completar o fluxo end-to-end em ≤5 turnos de chat** após a imagem ter sido gerada, com vocabulário acessível a um dono de comércio que nunca usou o Meta Ads Manager.

## Requirements

### Requirement 1: Tool `propose_campaign` no orchestrator

**Objective:** Como dono de comércio leigo (Pedro), quero que o agente monte automaticamente uma proposta de campanha resumindo tudo que vai pro Meta, para que eu não precise preencher formulário técnico.

#### Acceptance Criteria
1. The Orchestrator shall expose a tool named `propose_campaign` cuja descrição instrui o LLM a invocá-la apenas quando: (a) há um criativo gerado (`creative_id`) e (b) o usuário sinalizou intenção de anunciar.
2. When `propose_campaign` é invocado, the Orchestrator shall validar que `creative_id` existe na tabela `creatives` e pertence ao `company_id` do tenant.
3. When `propose_campaign` é invocado sem objetivo explícito, the Orchestrator shall pré-preencher `objective` a partir da `primary_offer.format` da briefing (curso → SALES, serviço → LEADS, físico → SALES) e marcar como sugestão editável.
4. When `propose_campaign` é invocado sem audience, the Orchestrator shall pré-preencher targeting a partir do `briefing.audience` (faixa etária, localização, interesses) e do `creative.format` (story → mobile only).
5. When `propose_campaign` é invocado sem orçamento, the Orchestrator shall sugerir um valor mínimo seguro (R$10/dia, mínimo Meta) e marcar como editável.
6. When `propose_campaign` é invocado sem `headline`/`body`/`cta`, the Orchestrator shall gerar copy curta a partir do `primary_offer.name`, `short_description` e `tone` da briefing, respeitando limites Meta (40/125/27 chars + cta enum).
7. When validação dos pré-preenchidos passa, the Orchestrator shall persistir o resultado como linha em `campaign_proposals` com `status='pending_approval'` e devolver ao chat o `proposal_id` para renderização inline.
8. If a empresa não tem `ad_account_id`, `page_id` ou criativo válido, the Orchestrator shall abortar a tool, retornar mensagem instruindo o LLM a explicar o que falta, e NÃO criar linha em `campaign_proposals`.

### Requirement 2: Card de proposta inline no chat

**Objective:** Como Pedro, quero ver na conversa um cartão claro com tudo que será publicado (imagem, texto, público, gasto/dia), para revisar e aprovar com um clique sem abrir outra tela.

#### Acceptance Criteria
1. While `campaign_proposals.status = 'pending_approval'`, the ChatView shall renderizar um `InlineCampaignProposalCard` abaixo da mensagem do agente que invocou `propose_campaign`.
2. The InlineCampaignProposalCard shall exibir: thumbnail do criativo (signed URL TTL 5min), headline + body + CTA, objetivo em linguagem leiga ("Vender mais"/"Conseguir contatos"/"Mais visitas no perfil"), público (idade + cidade/região + interesses top 3), orçamento diário em BRL, duração estimada se `stop_time` setado, e badge de compliance (verde/amarelo/vermelho).
3. The InlineCampaignProposalCard shall expor 3 ações: **Publicar** (primary, laranja), **Editar** (secundário, abre modal com campos), **Cancelar** (ghost).
4. When o usuário clica **Cancelar**, the ChatView shall atualizar `campaign_proposals.status = 'cancelled'` e enviar mensagem `[SISTEMA] Proposta cancelada pelo usuario` invisível na UI mas visível no contexto do LLM.
5. When o usuário clica **Editar**, the ChatView shall abrir modal `CampaignProposalEditor` com campos: orçamento/dia, faixa etária, localização, headline, body, cta — e salvar via UPDATE em `campaign_proposals.payload_jsonb` ao confirmar.
6. While o card está visível, the ChatView shall escutar realtime (Supabase channel) em `campaign_proposals` para refletir mudanças de status sem F5.

### Requirement 3: Tool `publish_campaign` e invocação do edge `campaign-publish`

**Objective:** Como Pedro, quero clicar "Publicar" e ter a campanha realmente criada no Meta sem nenhum passo adicional, para que o anúncio comece a rodar.

#### Acceptance Criteria
1. When o usuário clica **Publicar** no card, the ChatView shall invocar a tool `publish_campaign(proposal_id)` injetando uma mensagem `[SISTEMA] Aprovo publicar a proposta <id>` no chat, fazendo o LLM disparar a tool em seguida.
2. When `publish_campaign` é invocado, the Orchestrator shall validar que `campaign_proposals.id` existe, pertence ao tenant, e está em `status='pending_approval'`; se não, retornar erro estruturado com motivo.
3. When validação passa, the Orchestrator shall montar o body do `campaign-publish` mapeando `payload_jsonb` para o schema Zod esperado e invocar a Edge Function via fetch com Authorization do user JWT.
4. When `campaign-publish` retorna 200, the Orchestrator shall atualizar `campaign_proposals.status = 'publishing'` + persistir `publication_id` retornado, e devolver ao chat um summary curto que cite o `publication_id`.
5. If `campaign-publish` retorna 4xx (validação/compliance), the Orchestrator shall atualizar `campaign_proposals.status = 'failed'` + persistir `error_payload`, devolver mensagem com a causa LITERAL pro LLM repassar ao usuário, e sugerir ao LLM oferecer "editar" ou "regenerar criativo".
6. If `campaign-publish` retorna 5xx ou timeout (>55s), the Orchestrator shall atualizar status = `failed` com `error_kind='upstream'`, e devolver instrução pro LLM dizer literalmente "houve um erro temporário no Meta, posso tentar de novo agora?".
7. The Orchestrator shall reusar `ad_account_id`, `page_id` e `pixel_id` da `ad_platform_connections` ativa do tenant — nunca solicitar esses IDs ao usuário pelo chat.

### Requirement 4: Polling de status pós-publicação

**Objective:** Como Pedro, quero ver dentro do próprio chat se meu anúncio foi publicado com sucesso ou falhou, para não precisar abrir outra tela.

#### Acceptance Criteria
1. While `campaign_proposals.status = 'publishing'`, the InlineCampaignProposalCard shall fazer poll em `campaign_publications.status` a cada 3s (ou via realtime channel se disponível).
2. When `campaign_publications.status = 'live'`, the InlineCampaignProposalCard shall atualizar para estado **publicado** com badge verde, link "Ver no Meta Ads Manager" (deep link `business.facebook.com/adsmanager`), e mensagem do agente "Pronto! Seu anúncio já está rodando."
3. When `campaign_publications.status = 'failed'`, the InlineCampaignProposalCard shall atualizar para estado **falhou** com badge vermelho, mostrar a causa de `failed_at_step` ("compliance"|"campaign_create"|"adset_create"|"creative_create"|"ad_create"), e botão **Tentar de novo** que dispara `publish_campaign` novamente.
4. When o status final é atingido (live ou failed), the ChatView shall encerrar o polling e gravar o estado final no DB.

### Requirement 5: System prompt v2 — guia proativo do leigo

**Objective:** Como Pedro, quero que o agente me leve pela mão depois de gerar a imagem, sem eu precisar saber o que pedir em seguida, para concluir tudo naturalmente.

#### Acceptance Criteria
1. After uma resposta do agente conter o marker `<creative-gallery ids="..."/>` (criativo recém-gerado), the Orchestrator system prompt shall instruir o LLM a, na MESMA mensagem ou na próxima, perguntar **uma única coisa por vez** na seguinte ordem: (a) confirmar se quer anunciar a oferta detectada, (b) coletar valor diário se ainda não setado, (c) invocar `propose_campaign`.
2. The Orchestrator system prompt shall conter um glossário leigo: "campanha → anúncio que vai rodar no Facebook/Instagram", "objetivo → o que você quer que aconteça", "audience → quem vai ver", "budget → quanto investir por dia", a ser usado nas mensagens ao usuário.
3. The Orchestrator system prompt shall proibir jargão Meta cru (CPM/CPC/CTR/objective_codes/optimization_goal) nas mensagens ao usuário sem tradução em parênteses.
4. While `briefing.business_context` indica negócio físico local (mercearia/padaria/loja), the Orchestrator system prompt shall instruir o LLM a sugerir defaults compatíveis: objetivo `TRAFFIC` ou `ENGAGEMENT`, targeting com raio geográfico de 5km, copy mencionando o bairro/cidade.
5. The Orchestrator system prompt shall instruir que, após `publish_campaign` resultar em `live`, agente celebra brevemente (1 frase) e oferece próximo passo concreto: "Quer que eu monitore essa campanha e te avise se algo mudar?".

### Requirement 6: Persistência e auditoria das propostas

**Objective:** Como time/admin, quero que toda proposta gerada via chat fique versionada e auditável, para investigar erros, custos e comportamento do agente.

#### Acceptance Criteria
1. The data model shall conter tabela `campaign_proposals` com colunas: `id uuid PK`, `company_id`, `conversation_id`, `creative_id`, `payload_jsonb` (campos completos da campanha), `status enum('pending_approval','cancelled','publishing','live','failed')`, `publication_id` (FK para `campaign_publications`, nullable), `error_payload jsonb`, `created_at`, `updated_at`, `created_by_message_id`.
2. The campaign_proposals table shall ter RLS por `company_id = current_user_company_id()` para SELECT/UPDATE; INSERT só via Edge Function com service-role.
3. While o LLM gera múltiplas propostas em uma mesma conversa, the Orchestrator shall permitir mais de uma linha em `campaign_proposals` por `conversation_id` (cada proposta é independente).
4. When `campaign_proposals.status` muda, the data layer shall escrever timestamp atualizado em `updated_at` automaticamente via trigger.
5. The chat_messages table shall manter relação fraca: o assistant message que invoca `propose_campaign` recebe `metadata.proposal_id` para renderização posterior do card.

### Requirement 7: Pré-checagem de compliance no card

**Objective:** Como Pedro, quero ser avisado antes de publicar se o anúncio pode ser bloqueado por regras do Meta, para evitar publicar e ser pego.

#### Acceptance Criteria
1. While `propose_campaign` monta a proposta, the Orchestrator shall invocar `compliance-officer` (ou `rescan_compliance` em modo dry-run) sobre headline+body+image_url e capturar `severity` (none/low/medium/high) + `hits[]`.
2. While severity = `none|low`, the InlineCampaignProposalCard shall mostrar badge **verde** "Compliance OK" sem bloquear publicação.
3. While severity = `medium`, the InlineCampaignProposalCard shall mostrar badge **amarelo** com lista dos hits e mensagem "Pode publicar, mas o Meta pode reduzir alcance."
4. If severity = `high`, the InlineCampaignProposalCard shall mostrar badge **vermelho** + bloquear botão **Publicar** + sugerir "Edite o texto pra remover [termos]" via mensagem do agente.
5. The compliance pre-check shall ter timeout interno de 10s; se exceder, prosseguir com badge cinza "Não foi possível verificar agora" e permitir publicação (fail-open consciente — `campaign-publish` tem seu próprio gate definitivo).

### Requirement 8: Integração com sincronização Meta pós-publicação

**Objective:** Como Pedro, quero ver minha campanha recém-criada no Painel logo após publicar, sem precisar refresh manual, para confirmar que existe.

#### Acceptance Criteria
1. When `campaign_publications.status = 'live'`, the Orchestrator shall agendar (via job/trigger ou call direta) o `meta-sync` no escopo dessa campanha para popular `campaigns` e `campaign_metrics` em até 60s.
2. When `meta-sync` conclui, the data layer shall garantir que a nova `campaigns.id` está visível para queries de `get_campaigns_summary` e `get_campaign_details`.
3. The chat shall, após sucesso, oferecer link contextual "Ver no Painel" que dispara `navigateToView('painel')` filtrado pela campanha nova.

### Requirement 9: Telemetria e custo

**Objective:** Como time/admin, quero medir tempo, tokens e taxa de sucesso do fluxo, para otimizar prompts e identificar regressões.

#### Acceptance Criteria
1. The Orchestrator shall logar em `agent_runs` com `agent_name='ai-chat'` cada chamada de `propose_campaign` e `publish_campaign` registrando `tokens`, `cost_usd`, `latency_ms`, `tools_used`.
2. While um fluxo completo (do `<creative-gallery>` até `status='live'`) acontece em uma conversa, the data layer shall permitir query agregada que conte `total_proposals`, `published`, `cancelled`, `failed`, `avg_turns_to_publish` por janela temporal.
3. If `publish_campaign` falhar, the Orchestrator shall registrar `error_kind` em telemetria com valores `validation|compliance|upstream|timeout|unknown`.

### Requirement 10: Gate de pré-requisitos do tenant

**Objective:** Como Pedro recém-cadastrado, quero ser informado claramente do que falta (conectar Meta, escolher página, completar briefing) antes de tentar publicar pelo chat, para não tomar erro técnico.

#### Acceptance Criteria
1. When `propose_campaign` é invocado e o tenant não tem `ad_platform_connections` ativa, the Orchestrator shall retornar erro `missing_meta_connection` e instruir o LLM a sugerir literalmente "Você precisa conectar sua conta Meta primeiro. Posso te levar lá?" + oferecer link `/integrations`.
2. When `propose_campaign` é invocado e a `ad_platform_connections` ativa não tem `page_id` selecionada, the Orchestrator shall retornar erro `missing_page_selection` e instruir o LLM a guiar o usuário até `/integrations` para selecionar a Página do Facebook.
3. When `propose_campaign` é invocado e o briefing está incompleto (`v_company_briefing_status.is_complete = false`), the Orchestrator shall NÃO bloquear, mas instruir o LLM a notificar "Sua oferta principal vai dar mais resultado quando você completar seu briefing — quer fazer agora rapidinho ou continuamos?".
4. The Orchestrator shall NUNCA pedir ao usuário pelo chat IDs técnicos (`ad_account_id`, `page_id`, `pixel_id`); todos vêm do tenant via lookup.
