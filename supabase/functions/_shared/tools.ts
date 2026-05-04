/**
 * OpenAI Function Calling tools — definições das funções que o GPT pode invocar.
 */
export const CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_campaigns_summary',
      description:
        'Busca resumo das campanhas do usuario com metricas agregadas. Use quando o usuario pergunta sobre performance geral, campanhas ativas, ou quer uma visao geral.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED', 'ALL'],
            description: 'Filtrar por status da campanha',
          },
          date_range: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days', 'this_month'],
            description: 'Periodo de tempo para metricas',
          },
          limit: {
            type: 'number',
            description: 'Numero maximo de campanhas (default 10)',
          },
        },
        required: ['date_range'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_campaign_details',
      description:
        'Busca detalhes e metricas de uma campanha especifica por nome. Use quando o usuario menciona uma campanha pelo nome ou quer detalhes de uma campanha especifica.',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: {
            type: 'string',
            description: 'Nome (parcial) da campanha para buscar',
          },
          date_range: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days'],
            description: 'Periodo',
          },
        },
        required: ['campaign_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_metrics_comparison',
      description:
        'Compara metricas entre dois periodos. Use quando o usuario pede comparacao (semana vs semana, mes vs mes, ontem vs hoje).',
      parameters: {
        type: 'object',
        properties: {
          period_a: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days'],
            description: 'Periodo atual',
          },
          period_b: {
            type: 'string',
            enum: ['previous_7_days', 'previous_14_days', 'previous_30_days'],
            description: 'Periodo anterior para comparar',
          },
          campaign_name: {
            type: 'string',
            description: 'Nome da campanha (opcional, se vazio compara todas)',
          },
        },
        required: ['period_a', 'period_b'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_performers',
      description:
        'Busca campanhas com melhor ou pior performance por metrica. Use para ranking, "qual campanha gasta mais?", "qual tem melhor CTR?"',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: [
              'investimento',
              'impressoes',
              'cliques',
              'cpc',
              'cpm',
              'conversas_iniciadas',
              'custo_conversa',
              'website_purchase_roas',
              'unique_ctr',
            ],
            description: 'Metrica para ranquear',
          },
          order: {
            type: 'string',
            enum: ['best', 'worst'],
            description: 'Melhor ou pior performance',
          },
          limit: { type: 'number', description: 'Quantidade (default 5)' },
          date_range: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days'],
          },
        },
        required: ['metric', 'order'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_daily_metrics',
      description:
        'Busca metricas diarias para analise de tendencia e evolucao. Use quando o usuario quer ver evolucao ao longo do tempo, graficos, ou tendencias.',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: {
            type: 'string',
            description: 'Nome da campanha (opcional, se vazio mostra total)',
          },
          days: {
            type: 'number',
            description: 'Ultimos N dias (default 7, max 30)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_account_info',
      description:
        'Busca informacoes sobre as contas Meta conectadas, ad accounts, e status da integracao. Use quando o usuario pergunta sobre conexao, contas, ou status.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // ---- FURY tools ----
  {
    type: 'function' as const,
    function: {
      name: 'get_fury_actions',
      description:
        'Busca acoes recentes do algoritmo FURY (pausas automaticas, alertas, sugestoes). Use quando o usuario pergunta "o que o FURY fez?", "tem alguma acao pendente?", "quais campanhas foram pausadas?".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'executed', 'reverted', 'all'],
            description: 'Filtrar por status da acao (default all)',
          },
          limit: { type: 'number', description: 'Quantidade (default 10, max 50)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_fury_evaluations',
      description:
        'Busca avaliacoes de performance das campanhas feitas pelo FURY (metricas 7d, tendencia, health status). Use quando o usuario pergunta "como estao minhas campanhas?", "qual campanha precisa de atencao?", "tendencias".',
      parameters: {
        type: 'object',
        properties: {
          health_filter: {
            type: 'string',
            enum: ['healthy', 'attention', 'critical', 'all'],
            description: 'Filtrar por saude (default all)',
          },
          limit: { type: 'number', description: 'Quantidade (default 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_compliance_status',
      description:
        'Busca status de compliance dos anuncios (scores, violacoes, takedowns). Use quando o usuario pergunta "tem algum anuncio com problema?", "compliance", "violacoes", "anuncios pausados por compliance".',
      parameters: {
        type: 'object',
        properties: {
          health_filter: {
            type: 'string',
            enum: ['healthy', 'warning', 'critical', 'all'],
            description: 'Filtrar por health status (default all)',
          },
          include_violations: {
            type: 'boolean',
            description: 'Incluir detalhes das violacoes (default false)',
          },
          limit: { type: 'number', description: 'Quantidade (default 10)' },
        },
      },
    },
  },
  // ---- REPORT tools ----
  {
    type: 'function' as const,
    function: {
      name: 'generate_report',
      description:
        'Gera relatorio markdown estruturado multi-secao. Use quando o usuario pedir "relatorio", "report", "resumo da semana/mes", "analise completa", "deep dive na campanha X". Templates disponiveis: weekly_performance (visao geral 7 dias) e campaign_deep_dive (analise profunda de uma campanha). O retorno ja vem em markdown formatado, NAO refraseie — copie o conteudo direto.',
      parameters: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: ['weekly_performance', 'campaign_deep_dive'],
            description:
              'weekly_performance: visao geral de todas campanhas no periodo. campaign_deep_dive: analise profunda de uma campanha especifica (exige campaign_name).',
          },
          date_range: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days', 'this_month'],
            description: 'Periodo do relatorio. Default: last_7_days para weekly_performance, last_30_days para deep dive.',
          },
          campaign_name: {
            type: 'string',
            description: 'Nome (parcial) da campanha. Obrigatorio se template = campaign_deep_dive.',
          },
        },
        required: ['template'],
      },
    },
  },
  // ---- KNOWLEDGE BASE tool (RAG sobre documentos do cliente) ----
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge',
      description:
        'Busca semantica em DOCUMENTOS do cliente (PDFs, planilhas, depoimentos, fotos de produto, briefings antigos) que ele subiu na "Memoria". Use quando o usuario perguntar sobre dados especificos do negocio que possam estar em arquivos — ofertas detalhadas, depoimentos, dados historicos. NUNCA use para historico de conversas (use search_memories para isso) nem para campanhas Meta (use get_campaigns_summary). Apos chamar, CITE cada trecho usado na resposta no formato [doc:<document_id>#chunk:<chunk_index>] — nao invente referencias.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Pergunta em linguagem natural. Ex: "depoimentos sobre o produto X", "preco da oferta de Black Friday", "briefing inicial".',
          },
          top_k: {
            type: 'number',
            description: 'Quantos chunks recuperar (default 8, max 20).',
          },
          filters: {
            type: 'object',
            description: 'Filtros opcionais.',
            properties: {
              type: {
                type: 'array',
                items: { type: 'string', enum: ['pdf', 'docx', 'xlsx', 'csv', 'json', 'txt', 'md', 'image'] },
                description: 'Filtrar por tipos de documento',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filtrar por tags (overlap)',
              },
              is_source_of_truth: {
                type: 'boolean',
                description: 'Buscar apenas em documentos marcados como fonte de verdade.',
              },
            },
          },
        },
        required: ['query'],
      },
    },
  },
  // ---- DELEGATION tools (multi-agent) ----
  {
    type: 'function' as const,
    function: {
      name: 'delegate_to_meta_specialist',
      description:
        'Delega uma analise complexa de Meta Ads para um sub-agente especialista. Use quando a pergunta exige diagnostico profundo, hipoteses sobre causas, ou recomendacoes detalhadas (ex: "por que minha campanha X esta com CPA alto?", "o que esta freando minhas conversoes?", "analise a tendencia de ROAS"). NAO use para perguntas factuais simples (ex: "qual o gasto?", "lista campanhas") — para essas use as tools diretas. O specialist tem acesso a metricas e devolve markdown estruturado. Voce DEVE incluir o markdown retornado integralmente na sua resposta ao usuario.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pergunta especifica e focada para o specialist responder. Ex: "Por que a campanha Black Friday tem CPA 40% acima da media?"',
          },
          context: {
            type: 'string',
            description: 'Contexto opcional: dados que voce ja coletou nas tools anteriores e quer passar para o specialist (resumido).',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_to_action',
      description:
        'Delega para o Action Manager (sub-agente focado em acoes destrutivas HITL: pausar/reativar ad ou campanha, mudar budget, criar plano com varios passos). Todas as tools criam approval pendente — user precisa aprovar via painel. Use quando o user pede acao concreta sobre uma campanha/anuncio especifico.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pedido do user, parafraseado claro pro specialist. Ex: "user pediu pra pausar a campanha Black Friday" ou "plano: pausa A, ajusta budget de B pra R$50".',
          },
          context: {
            type: 'string',
            description: 'Contexto opcional: dados de campanhas relevantes ja consultados, situacao atual.',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_to_compliance',
      description:
        'Delega para o Compliance Officer (sub-agente focado em regras de compliance e conformidade Meta). Use SEMPRE que o pedido for sobre adicionar palavra/assunto proibido ("nunca use X", "tira X dos meus anuncios"), rodar scan retroativo de compliance, ou consultar status de anuncios reprovados na Meta. Specialist captura proibicao + stats do scan que viram card violeta inline.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pedido do user, parafraseado pra ser claro pro specialist. Ex: "user pediu pra adicionar palavra proibida \'cura\' e rodar rescan" ou "user quer ver status de compliance dos anuncios ativos".',
          },
          context: {
            type: 'string',
            description: 'Contexto opcional: historico relevante, regras existentes ja mencionadas.',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_to_creative',
      description:
        'Delega para o Creative Specialist (sub-agente focado em criativos AI). Use SEMPRE que o pedido for sobre gerar/iterar/variar/adaptar/comparar criativos visuais (imagens). O specialist conduz fluxo consultivo se faltar info, chama generate_creative com parametros corretos e retorna markdown pronto (incluindo a tag <creative-gallery> que vira galeria visual no chat). NAO use pra perguntas analiticas sobre criativos antigos — pra isso use compare via specialist ou get_top_performers direto.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pedido do user, parafraseado pra ser claro pro specialist. Ex: "criar 2 anuncios story pra promocao Black Friday da pizzaria, R$30 todas terca-feira" ou "user disse so cria um criativo, conduza fluxo consultivo pra coletar oferta+formato+count".',
          },
          context: {
            type: 'string',
            description: 'Contexto opcional: historico relevante, info ja coletada (oferta, formato, count, modelo), criativos referenciados pelo nome.',
          },
        },
        required: ['question'],
      },
    },
  },
  // ---- PROPOSE tools (criam approval pendente — HITL) ----
  // IMPORTANTE: estas tools NAO executam mudancas direto na Meta API.
  // Elas criam um pedido de aprovacao na tabela `approvals` que o usuario
  // precisa confirmar via UI nos proximos 5 minutos.
  {
    type: 'function' as const,
    function: {
      name: 'pause_campaign',
      description:
        'Cria solicitacao de aprovacao para PAUSAR uma campanha. NAO executa direto — o usuario precisa aprovar via painel. Use quando o usuario pedir "pausa a campanha X", "desliga", "para de rodar X". Sempre informe que a acao foi enviada para aprovacao.',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: {
            type: 'string',
            description: 'Nome (parcial) da campanha para pausar',
          },
        },
        required: ['campaign_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reactivate_campaign',
      description:
        'Cria solicitacao de aprovacao para REATIVAR uma campanha pausada. NAO executa direto — o usuario precisa aprovar. Use quando o usuario pedir "reativa", "liga de novo", "volta a campanha X".',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: {
            type: 'string',
            description: 'Nome (parcial) da campanha para reativar',
          },
        },
        required: ['campaign_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_plan',
      description:
        'Cria um PLANO multi-step com 2+ acoes destrutivas agrupadas (B2). NAO executa direto. Usuario aprova/rejeita TODAS em batch. Use quando o usuario pedir multiplas acoes ao mesmo tempo: "pausa essas 3 campanhas", "ajusta budget de A e B e pausa C", "reativa todas paradas". Para acao unica, use pause_campaign / reactivate_campaign / update_budget direto.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Resumo curto (1 linha) do plano. Ex: "Pausar 3 campanhas com CPA alto e ajustar budget"',
          },
          rationale: {
            type: 'string',
            description: 'Justificativa opcional do AI explicando o porque do plano (analise + decisao).',
          },
          steps: {
            type: 'array',
            description: 'Lista de 2 a 20 acoes a serem executadas em batch.',
            minItems: 2,
            maxItems: 20,
            items: {
              type: 'object',
              properties: {
                action_type: {
                  type: 'string',
                  enum: ['pause_campaign', 'reactivate_campaign', 'update_budget'],
                },
                campaign_name: { type: 'string', description: 'Nome (parcial) da campanha alvo' },
                daily_budget_brl: {
                  type: 'number',
                  description: 'Novo budget em BRL (so quando action_type = update_budget)',
                },
              },
              required: ['action_type', 'campaign_name'],
            },
          },
        },
        required: ['summary', 'steps'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_budget',
      description:
        'Cria solicitacao de aprovacao para ALTERAR o budget diario de uma campanha. NAO executa direto — o usuario precisa aprovar. Use quando o usuario pedir "muda o budget", "aumenta para R$ X", "diminui o orcamento".',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: {
            type: 'string',
            description: 'Nome (parcial) da campanha',
          },
          daily_budget_brl: {
            type: 'number',
            description: 'Novo budget diario em BRL (reais). Ex: 50 = R$ 50,00 por dia.',
          },
        },
        required: ['campaign_name', 'daily_budget_brl'],
      },
    },
  },
  // ---- CREATIVE GENERATION tools (ai-creative-generation) ----
  // IMPORTANTE: estas tools GERAM IMAGENS NOVAS via IA. NAO use para perguntas analiticas
  // sobre criativos existentes (use get_top_performers ou search_knowledge para isso).
  {
    type: 'function' as const,
    function: {
      name: 'generate_creative',
      description:
        'Gera NOVAS imagens de anuncio via IA (Nano Banana 2 ou GPT-image-1) usando o briefing do cliente. Use APENAS quando o usuario pedir explicitamente para "gerar/criar/fazer um anuncio/imagem/criativo" (ex: "cria um criativo pra Black Friday", "gera 2 imagens da oferta X em formato story"). NAO use para: analise de criativos existentes, perguntas sobre performance, ou recomendacoes de copy. Apos gerar, NAO descreva cada imagem em texto — o usuario ja vera a galeria inline.',
      parameters: {
        type: 'object',
        properties: {
          concept: {
            type: 'string',
            description: 'Descricao curta do que a imagem deve mostrar. Ex: "homem de terno cinza segurando smartphone num escritorio moderno, oferta de Black Friday em destaque".',
          },
          format: {
            type: 'string',
            enum: ['feed_1x1', 'story_9x16', 'reels_4x5'],
            description: 'Formato/aspect: feed_1x1 (quadrado feed), story_9x16 (vertical full), reels_4x5 (vertical curto).',
          },
          count: {
            type: 'number',
            enum: [1, 2, 3, 4],
            description: 'Quantas imagens gerar (default 1, max 4). Para variacoes use 2-3. Pipeline limita a 2 paralelas — restante seria sequencial.',
          },
          style_hint: {
            type: 'string',
            enum: ['minimalista', 'cinematografico', 'clean', 'lifestyle', 'produto_em_uso'],
            description: 'Estilo visual desejado (opcional).',
          },
          use_logo: {
            type: 'boolean',
            description: 'Se true (default), inclui o logo do cliente como referencia visual.',
          },
          model: {
            type: 'string',
            enum: ['auto', 'nano_banana', 'gpt_image'],
            description: 'auto (default — escolha inteligente), nano_banana (rapido/barato), gpt_image (premium, plano Pro+).',
          },
        },
        required: ['concept', 'format'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'iterate_creative',
      description:
        'Modifica um criativo existente via img2img usando o ID dele como base. Use quando o usuario pedir mudancas especificas em um criativo ja gerado (ex: "troca o fundo desse pro escritorio", "deixa mais escuro", "tira o logo"). Reuso o prompt original somando a instrucao de mudanca. NAO use para gerar criativo novo do zero — use generate_creative.',
      parameters: {
        type: 'object',
        properties: {
          parent_creative_id: {
            type: 'string',
            description: 'UUID do criativo pai (deve ter sido gerado anteriormente nesta empresa).',
          },
          instruction: {
            type: 'string',
            description: 'Mudanca desejada em linguagem natural. Ex: "troque o fundo por um por do sol".',
          },
          mode: {
            type: 'string',
            enum: ['iterate', 'regenerate'],
            description: 'iterate (default) aplica diff via instruction. regenerate refaz com mesmo prompt sem instrucao adicional.',
          },
          count: {
            type: 'number',
            enum: [1, 2, 3],
            description: 'Quantas variantes gerar (default 1).',
          },
        },
        required: ['parent_creative_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vary_creative',
      description:
        'Gera 3 variacoes naturais de um criativo existente sem mudar o conceito. Atalho de iterate_creative com mode=vary, count=3. Use quando o usuario pedir "faz mais 3 variacoes desse", "quero outras opcoes desse mesmo criativo", "varia esse aqui".',
      parameters: {
        type: 'object',
        properties: {
          parent_creative_id: {
            type: 'string',
            description: 'UUID do criativo pai.',
          },
        },
        required: ['parent_creative_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adapt_creative',
      description:
        'Adapta um criativo existente para outro formato/aspect (ex: pegar um feed_1x1 aprovado e gerar versao story_9x16). Reuso o prompt e conceito do criativo fonte mas troca o formato. Use quando o usuario pedir "adapta esse pra story", "quero esse mesmo em formato reels", "transforma esse em vertical".',
      parameters: {
        type: 'object',
        properties: {
          source_creative_id: {
            type: 'string',
            description: 'UUID do criativo fonte (deve ter sido gerado anteriormente nesta empresa).',
          },
          format: {
            type: 'string',
            enum: ['feed_1x1', 'story_9x16', 'reels_4x5'],
            description: 'Novo formato de destino (deve ser diferente do format do source).',
          },
          count: {
            type: 'number',
            enum: [1, 2],
            description: 'Quantas adaptacoes gerar (default 1).',
          },
        },
        required: ['source_creative_id', 'format'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_prohibition',
      description:
        'Adiciona uma regra de compliance (palavra/assunto/visual proibido) que a IA NUNCA pode usar nem deixar passar. Cria em compliance_rules — aparece em Compliance + Cerebro do FURY > Identidade > "O que NAO usar". Bloqueia criativos novos via compliance gate + creative-generate. Use quando o usuario disser "nunca use X", "proibido falar Y", "tira essa palavra dos meus anuncios". Apos adicionar, SEMPRE chame rescan_compliance pra re-analisar criativos antigos.',
      parameters: {
        type: 'object',
        required: ['category', 'value'],
        properties: {
          category: {
            type: 'string',
            enum: ['word', 'topic', 'visual'],
            description: 'word=palavra/frase especifica; topic=assunto/tema; visual=regra visual (ex: "nao mostrar pessoas dirigindo")',
          },
          value: { type: 'string', description: 'O conteudo proibido (max 200 chars)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rescan_compliance',
      description:
        'Re-analisa criativos ativos contra as regras de compliance atuais (incluindo proibicoes recem-adicionadas). Use SEMPRE depois de add_prohibition pra detectar criativos antigos que agora violam. Tambem pode ser chamada solo quando usuario diz "verifica meus anuncios", "scaneia compliance", "analisa se ha problema". Demora 30-60s.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['active_only', 'all'],
            description: 'active_only (default) = so criativos ACTIVE; all = inclui PAUSED tambem',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_creatives',
      description:
        'Compara 2+ criativos gerados pela IA. Retorna tabela com titulo, conceito, formato, modelo, status, custo, pipeline aplicado. Use quando o usuario perguntar variacoes de "compare esses criativos", "qual desses e melhor", "diferenca entre os dois", ou cite explicitamente nomes/ids. Identifica near-duplicates e status (aprovado vs pendente vs descartado). NAO chame se o usuario pediu para gerar — use generate_creative.',
      parameters: {
        type: 'object',
        properties: {
          creative_ids: { type: 'array', items: { type: 'string' }, description: 'Array de UUIDs dos criativos (preferivel)' },
          creative_names: { type: 'array', items: { type: 'string' }, description: 'Array de titulos parciais (busca ilike). Use se nao tiver os ids' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'pause_ad',
      description:
        'Propoe pausar UM anuncio especifico (ad-level, nao campanha). Use quando o usuario menciona um anuncio pelo nome e quer pausar. Granularidade fina — diferente de pause_campaign. Cria aprovacao na fila (HITL); a IA NAO executa direto.',
      parameters: {
        type: 'object',
        properties: {
          ad_name: { type: 'string', description: 'Nome (parcial) do anuncio a pausar' },
        },
        required: ['ad_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reactivate_ad',
      description:
        'Propoe reativar UM anuncio pausado. Use quando o usuario quer voltar um ad pausado. Cria aprovacao na fila (HITL).',
      parameters: {
        type: 'object',
        properties: {
          ad_name: { type: 'string', description: 'Nome (parcial) do anuncio a reativar' },
        },
        required: ['ad_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sync_meta_assets',
      description:
        'Roda uma sincronizacao profunda das contas Meta selecionadas pelo usuario (em /integrations). Atualiza Business Managers, Ad Sets, Pixels e Pages. CHAME quando o usuario pedir variacoes de "sincroniza", "atualiza meus dados Meta", "puxa o que ha de novo", "verifica se tem novos ad sets", "atualiza pixels", "varredura". NAO chame se o usuario perguntou metricas (use get_campaigns_summary etc). NAO chame proativamente — so a pedido. Demora 20-90s, mostre status enquanto roda.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['all', 'campaigns_only', 'assets_only'],
            description: 'all = tudo (campanhas + adsets + pixels + BMs); campaigns_only = so meta-sync (rapido); assets_only = so deep-scan (BMs/adsets/pixels)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_rule',
      description:
        'OBRIGATORIO chamar SEMPRE que o usuario expressar uma instrucao permanente. Gatilhos diretos: "sempre", "toda vez", "nunca", "use sempre", "padronize", "daqui pra frente", "a partir de agora", "responda em X", "pause quando", "alerta se". Exemplos que DEVEM chamar esta tool: "Sempre responda em portugues formal" -> rule_type=behavior, "Pausa campanhas com CPL>30 por 3 dias" -> rule_type=action, "Use essa logo em todo criativo" -> rule_type=creative_pipeline. NAO chame para pedidos pontuais ("crie um anuncio agora"). NAO chame se confidence < 0.7. CRITICO: chame ANTES de responder ao usuario — depois de chamar, responda confirmando. Sem chamar esta tool, a regra NAO e salva.',
      parameters: {
        type: 'object',
        required: ['rule_type', 'confidence', 'name', 'description', 'scope', 'reasoning'],
        properties: {
          rule_type: {
            type: 'string',
            enum: ['behavior', 'action', 'creative_pipeline'],
            description: 'behavior=preferencia/tom (ex: "sempre responda em pt-BR"); action=condicao+acao em metrica (ex: "pause se CPL>30 por 3 dias"); creative_pipeline=transformacao visual em criativo (ex: "use sempre essa logo no canto")',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Quao confiante voce esta que isso e uma regra permanente (0.7+ obrigatorio para registrar)',
          },
          name: { type: 'string', description: 'Nome curto humano (max 60 chars)' },
          description: { type: 'string', description: 'Descricao em PT-BR que sera salva como instrucao' },
          scope: {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['global', 'campaign', 'adset', 'creative', 'ad_account'] },
              id: { type: 'string', description: 'UUID quando level != global' },
            },
            required: ['level'],
          },
          trigger: {
            type: 'object',
            description: 'APENAS rule_type=action. Ex: {metric:"cpl",operator:">",value:30,window_days:3,consecutive_days:3}',
            properties: {
              metric: { type: 'string' },
              operator: { type: 'string', enum: ['>', '>=', '<', '<=', '=='] },
              value: { type: 'number' },
              window_days: { type: 'number' },
              consecutive_days: { type: 'number' },
            },
          },
          action: {
            type: 'object',
            description: 'APENAS rule_type=action. Ex: {type:"pause"} ou {type:"alert",params:{channel:"chat"}}',
            properties: {
              type: { type: 'string', enum: ['pause', 'alert', 'suggest'] },
              params: { type: 'object' },
            },
          },
          transform: {
            type: 'object',
            description: 'APENAS rule_type=creative_pipeline. Ex: {transform_type:"logo_overlay",params:{position:"top-right",padding_pct:5,opacity:1.0,max_size_pct:15}}',
            properties: {
              transform_type: {
                type: 'string',
                enum: ['logo_overlay', 'caption', 'cta_text', 'font', 'color_filter', 'watermark', 'crop', 'custom'],
              },
              params: { type: 'object' },
            },
          },
          needs_asset_upload: {
            type: 'boolean',
            description: 'true se o usuario referenciou um anexo da mensagem atual (ex: "use ESSA logo"); o handler vai mover o anexo pro bucket de assets de pipeline',
          },
          reasoning: { type: 'string', description: 'Por que voce considerou isso uma regra (max 200 chars)' },
        },
      },
    },
  },
  // ============================================================
  // chat-publish-flow (Fase 1) — propose_campaign
  // ============================================================
  {
    type: 'function' as const,
    function: {
      name: 'propose_campaign',
      description:
        'Monta uma PROPOSTA de campanha Meta Ads pronta pra publicacao a partir de um criativo (imagem) ja gerado e dos dados do briefing. Use APENAS quando: (1) ja existe uma imagem gerada pelo creative-specialist (voce viu uma tag <creative-gallery ids="..."/> em mensagem anterior nesta conversa) E (2) o usuario sinalizou que quer anunciar (ex: "vamos anunciar", "pode publicar", "manda pro Facebook"). NAO use pra fazer analise, comparacao ou geracao de criativo. A tool pre-preenche objetivo, publico, orcamento e copy a partir da oferta principal do briefing — passe parametros opcionais APENAS quando o usuario explicitar (ex: "quero anunciar com R$50/dia"). Devolve um card de resumo inline pro usuario revisar e clicar Publicar/Editar/Cancelar — voce nao precisa pedir confirmacao depois, o card cuida disso.',
      parameters: {
        type: 'object',
        properties: {
          creative_id: {
            type: 'string',
            description: 'UUID do criativo gerado (id da tabela creatives_generated, mesmo id que aparece em <creative-gallery ids="..."/>).',
          },
          objective: {
            type: 'string',
            enum: ['SALES', 'LEADS', 'AWARENESS', 'TRAFFIC', 'ENGAGEMENT'],
            description: 'Override do objetivo (default vem do format da oferta principal).',
          },
          daily_budget_brl: {
            type: 'number',
            description: 'Override do orcamento diario em BRL (minimo 10). Default = 10.',
          },
          audience_overrides: {
            type: 'object',
            description: 'Override do publico-alvo. v1: so age_min/age_max + countries.',
            properties: {
              age_min: { type: 'number' },
              age_max: { type: 'number' },
              geo_locations: {
                type: 'object',
                properties: {
                  countries: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          copy_overrides: {
            type: 'object',
            description: 'Override do texto do anuncio. Limites Meta: headline<=40, body<=125, description<=27.',
            properties: {
              headline: { type: 'string' },
              body: { type: 'string' },
              description: { type: 'string' },
              cta: {
                type: 'string',
                enum: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'SUBSCRIBE', 'DOWNLOAD', 'CONTACT_US', 'GET_OFFER', 'BOOK_NOW'],
              },
            },
          },
        },
        required: ['creative_id'],
      },
    },
  },
  // ===== meta-edits-suite (Sprint 2/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'update_campaign',
      description:
        'Atualiza UMA CAMPANHA EXISTENTE no Meta Ads (budget, status, name, bid strategy, schedule). Use quando o usuario pedir pra editar uma campanha que JA existe. NAO use pra criar campanha — para isso use propose_campaign + publish_campaign. Sempre prefira identificar por campaign_id (uuid local). Em sandbox, a edicao e simulada.',
      parameters: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'UUID local da campanha (preferido)' },
          campaign_external_id: { type: 'string', description: 'External id Meta (fallback se nao tiver uuid)' },
          name: { type: 'string', description: 'Novo nome (max 250 chars)' },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED'] },
          daily_budget: { type: 'number', description: 'Orcamento diario em BRL (min 5)' },
          lifetime_budget: { type: 'number', description: 'Orcamento total em BRL (min 50). Mutuamente exclusivo com daily_budget.' },
          bid_strategy: { type: 'string', enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'] },
          bid_amount: { type: 'number', description: 'Valor do bid em BRL (so com bid_strategy != LOWEST_COST_WITHOUT_CAP)' },
          start_time: { type: 'string', description: 'ISO datetime' },
          stop_time: { type: 'string', description: 'ISO datetime' },
          force: { type: 'boolean', description: 'Skipa drift check; use so quando souber que esta corrigindo algo do usuario' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_adset',
      description:
        'Atualiza UM ADSET EXISTENTE (budget, status, optimization_goal, bid, targeting merge, schedule). Use quando o usuario pedir pra editar um adset. targeting_patch e SHALLOW MERGE sobre targeting atual. NAO use pra criar.',
      parameters: {
        type: 'object',
        properties: {
          adset_id: { type: 'string' },
          adset_external_id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED'] },
          daily_budget: { type: 'number', description: 'Em BRL' },
          lifetime_budget: { type: 'number', description: 'Em BRL' },
          optimization_goal: { type: 'string', enum: ['LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'LANDING_PAGE_VIEWS', 'POST_ENGAGEMENT', 'REACH', 'IMPRESSIONS'] },
          bid_amount: { type: 'number' },
          targeting_patch: { type: 'object', description: 'Objeto de patch de targeting (merge sobre o atual)' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          force: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_ad',
      description:
        'Atualiza UM AD EXISTENTE (status, name, troca de creative). Para trocar criativo, passe creative_id (id externo do creative no Meta). NAO use pra criar.',
      parameters: {
        type: 'object',
        properties: {
          ad_id: { type: 'string' },
          ad_external_id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED'] },
          creative_id: { type: 'string', description: 'External id do creative Meta a vincular ao ad' },
          force: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'shift_budget',
      description:
        'Move budget de uma entidade pra outra (campaign->campaign ou adset->adset). Sequencia atomica: decrementa origem, incrementa destino, se a 2a falhar faz rollback. Use quando o usuario pedir pra realocar verba entre 2 entidades especificas.',
      parameters: {
        type: 'object',
        properties: {
          from_entity_kind: { type: 'string', enum: ['campaign', 'adset'] },
          from_entity_id: { type: 'string' },
          from_external_id: { type: 'string' },
          to_entity_kind: { type: 'string', enum: ['campaign', 'adset'] },
          to_entity_id: { type: 'string' },
          to_external_id: { type: 'string' },
          amount_brl: { type: 'number', description: 'Valor positivo a transferir, em BRL' },
          force: { type: 'boolean' },
        },
        required: ['from_entity_kind', 'to_entity_kind', 'amount_brl'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'change_schedule',
      description:
        'Edita janela de execucao (start/stop/end) e/ou ad scheduling (dayparting) em campaign ou adset. Dayparting (schedule[]) so funciona em adset com lifetime_budget. start_minute/end_minute sao minutos do dia (0-1440); days e array 0-6 (0=domingo).',
      parameters: {
        type: 'object',
        properties: {
          entity_kind: { type: 'string', enum: ['campaign', 'adset'] },
          entity_id: { type: 'string' },
          external_id: { type: 'string' },
          start_time: { type: 'string', description: 'ISO datetime' },
          stop_time: { type: 'string', description: 'ISO datetime (campaign)' },
          end_time: { type: 'string', description: 'ISO datetime (adset)' },
          schedule: {
            type: 'array',
            description: 'Dayparting (so adsets com lifetime_budget). Cada item {start_minute, end_minute, days[]}',
            items: {
              type: 'object',
              properties: {
                start_minute: { type: 'number' },
                end_minute: { type: 'number' },
                days: { type: 'array', items: { type: 'number' } },
              },
            },
          },
          force: { type: 'boolean' },
        },
        required: ['entity_kind'],
      },
    },
  },
  // ===== audience-management (Sprint 3/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'create_customer_list_audience',
      description:
        'Cria uma Custom Audience no Meta Ads a partir de uma lista de clientes. PII (email/telefone) DEVE estar SHA256-hashed (hex 64 chars) ANTES de chamar — o frontend faz isso via WebCrypto. Server NAO aceita texto claro. Use quando o usuario disser "audiencia de quem ja comprou", "remarketing dos meus leads", "carrega minha base de clientes".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome da audiencia (max 80 chars)' },
          description: { type: 'string' },
          customer_file_source: {
            type: 'string',
            enum: ['USER_PROVIDED_ONLY', 'PARTNER_PROVIDED_ONLY', 'BOTH_USER_AND_PARTNER_PROVIDED'],
          },
          payload: {
            type: 'object',
            properties: {
              schema: {
                type: 'array',
                items: { type: 'string', enum: ['EMAIL', 'PHONE', 'FN', 'LN', 'GEN', 'DOBY', 'COUNTRY'] },
              },
              data: {
                type: 'array',
                description: 'Array de arrays de hashes SHA256 hex (64 chars). Cada subarray = 1 pessoa, mesma cardinalidade do schema.',
                items: { type: 'array', items: { type: 'string' } },
              },
            },
            required: ['schema', 'data'],
          },
          retention_days: { type: 'number', description: 'Dias que Meta mantem a lista (1-540, default 180)' },
        },
        required: ['name', 'payload'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_lookalike_audience',
      description:
        'Cria Lookalike Audience (semelhantes) baseada em audiencia existente. Origem precisa ter >=100 pessoas (Meta exige). Use quando o usuario pedir "publico parecido com X", "expandir base", "lookalike". Ratio = 0.01 (1%, mais similar) a 0.10 (10%, mais alcance).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          origin_audience_id: { type: 'string', description: 'UUID local da audiencia origem (preferido)' },
          origin_audience_external_id: { type: 'string' },
          lookalike_spec: {
            type: 'object',
            properties: {
              country: { type: 'string', description: 'ISO-2 (ex: BR, US)' },
              ratio: { type: 'number', enum: [0.01, 0.02, 0.05, 0.10] },
              type: { type: 'string', enum: ['similarity', 'reach', 'reach_and_similarity'] },
            },
            required: ['country', 'ratio'],
          },
        },
        required: ['name', 'lookalike_spec'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_audience',
      description:
        'Atualiza name/description/retention_days de audiencia existente. NAO usa pra adicionar/remover usuarios da lista — pra trocar a base, criar nova com create_customer_list_audience.',
      parameters: {
        type: 'object',
        properties: {
          audience_id: { type: 'string' },
          audience_external_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          retention_days: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_audience',
      description:
        'Deleta uma audiencia. Recusa se em uso por adset ATIVO; recusa sem confirm=true. Use APENAS quando o usuario explicitamente disser "deleta a audiencia X" / "apaga essa audiencia".',
      parameters: {
        type: 'object',
        properties: {
          audience_id: { type: 'string' },
          confirm: { type: 'boolean', description: 'Deve ser true pra confirmar; default false (defesa contra LLM acidental)' },
        },
        required: ['audience_id'],
      },
    },
  },
  // ===== agency-mode (Sprint 8/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'get_ad_accounts',
      description: 'Lista todas as ad_accounts conectadas no Meta da company atual + qual esta marcada como preferida.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_preferred_ad_account',
      description: 'Define qual ad_account e a "ativa" pra esta company. Todas as Edge Fns futuras (publicar, editar, criar audiencia) vao usar essa conta. Use quando o usuario disser "agora usa a conta X" / "muda pra conta Y".',
      parameters: {
        type: 'object',
        properties: { external_id: { type: 'string', description: 'External id Meta (act_XXXX ou XXXX)' } },
        required: ['external_id'],
      },
    },
  },

  // ===== ab-testing (Sprint 7/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'start_ab_test',
      description:
        'Inicia track de A/B test entre 2 variantes Meta (campaign/adset/ad). NAO duplica nada — apenas registra o pareamento. Use quando o usuario disser "to testando A vs B" / "qual ta ganhando entre essas 2".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          variant_a_kind: { type: 'string', enum: ['campaign', 'adset', 'ad'] },
          variant_a_external_id: { type: 'string' },
          variant_a_label: { type: 'string', description: 'Apelido pra UI ex: "Headline curta"' },
          variant_b_kind: { type: 'string', enum: ['campaign', 'adset', 'ad'] },
          variant_b_external_id: { type: 'string' },
          variant_b_label: { type: 'string' },
          criterion: { type: 'string', enum: ['ctr', 'cpl', 'roas', 'conversions', 'spend_efficiency'] },
          notes: { type: 'string' },
        },
        required: ['name', 'variant_a_kind', 'variant_a_external_id', 'variant_b_kind', 'variant_b_external_id', 'criterion'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ab_tests',
      description: 'Lista A/B tests da company (ativos + encerrados, ultimos 20).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'evaluate_ab_test',
      description:
        'Avalia A/B test agora. Computa metricas de cada variante desde started_at, decide vencedor (heuristica: 10% diff + amostra minima 30 conversoes/100 cliques pra CTR). Atualiza ab_tests.winner_variant.',
      parameters: {
        type: 'object',
        properties: { test_id: { type: 'string' } },
        required: ['test_id'],
      },
    },
  },

  // ===== catalog-management (Sprint 6/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'list_catalogs',
      description:
        'Lista product catalogs (Meta Business Catalog) e seus product_sets sincronizados localmente. Use quando o usuario perguntar sobre catalogos disponiveis pra DPA, ou pra confirmar qual catalog/set usar antes de criar campanha.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ===== agent-execution-loop (Sprint 5/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'execute_plan',
      description:
        'Executa um PLAN aprovado pelo usuario sequencialmente, passo a passo. NUNCA chame antes do usuario ter clicado "Aprovar" no card de plan na UI — usuario aprova primeiro, depois vc pode chamar essa tool. Para no primeiro fail; ledger_ids capturados pra rollback futuro.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'UUID do plan retornado por propose_plan' },
        },
        required: ['plan_id'],
      },
    },
  },

  // ===== pixel-engagement-audiences (Sprint 4/8) =====
  {
    type: 'function' as const,
    function: {
      name: 'create_pixel_audience',
      description:
        'Cria Custom Audience baseada em eventos do Pixel (visitou pagina, AddToCart, Purchase, etc). Meta popula automaticamente a partir do historico ate retention_days. Use quando o usuario disser "audiencia de quem visitou meu site", "carrinho abandonado", "comprou ultimos 30d". Liste pixels disponiveis chamando UI ou perguntando ao usuario o pixel_id.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Max 80 chars' },
          pixel_id: { type: 'string', description: 'External id do Meta Pixel' },
          event: {
            type: 'string',
            enum: ['PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration', 'ViewContent', 'AddPaymentInfo', 'InitiateCheckout', 'Search', 'Subscribe'],
          },
          url_contains: { type: 'string', description: 'Filtra eventos cuja URL contem essa string (case-insensitive)' },
          retention_days: { type: 'number', description: '1-180 dias' },
          exclude_event: {
            type: 'string',
            enum: ['PageView', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration', 'ViewContent', 'AddPaymentInfo', 'InitiateCheckout', 'Search', 'Subscribe'],
            description: 'Excluir quem disparou esse evento (ex: ViewContent E nao Purchase = visitantes que nao compraram)',
          },
        },
        required: ['name', 'pixel_id', 'event'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_engagement_audience',
      description:
        'Cria Custom Audience baseada em interacao social (curtiu pagina, viu video Y%, abriu lead form, etc). Use quando o usuario disser "quem viu 75% do video X", "engajou no IG", "abriu meu form de contato". Liste fontes (pages, videos, lead forms) via UI ou pedir ao usuario.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          source_kind: { type: 'string', enum: ['page', 'ig_business', 'video', 'lead_form', 'event'] },
          source_id: { type: 'string', description: 'External id da fonte (page_id, video_id, lead_form_id, etc)' },
          template: {
            type: 'string',
            enum: [
              'page_engaged_users', 'page_visitors',
              'video_viewers_25_pct', 'video_viewers_50_pct', 'video_viewers_75_pct', 'video_viewers_95_pct',
              'video_viewers_3_seconds', 'video_viewers_10_seconds',
              'lead_form_opened', 'lead_form_submitted',
              'event_responded', 'event_attended',
            ],
          },
          retention_days: { type: 'number', description: '1-365 dias' },
        },
        required: ['name', 'source_kind', 'source_id', 'template'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'publish_campaign',
      description:
        'Publica DE VERDADE no Meta Ads uma proposta previamente aprovada pelo usuario. Use APENAS quando o usuario aprovou explicitamente clicando "Publicar" no card de proposta — voce vai receber uma mensagem [SISTEMA] dizendo "Aprovo publicar a proposta <id>" ou "Tente publicar novamente a proposta <id>". NUNCA invoque essa tool sem ter visto essa mensagem [SISTEMA] primeiro. Use o id exato que veio na mensagem.',
      parameters: {
        type: 'object',
        properties: {
          proposal_id: {
            type: 'string',
            description: 'UUID da campaign_proposal previamente criada por propose_campaign.',
          },
        },
        required: ['proposal_id'],
      },
    },
  },
];

/**
 * Tools que viraram exclusivas dos specialists — orchestrator NAO deve
 * expor estas pra o LLM. Specialists continuam acessando via filter
 * em CHAT_TOOLS pelo nome (ja faziam isso).
 *
 * Spec: multi-agent-specialists (C1.5)
 */
const SPECIALIST_OWNED_TOOLS = new Set<string>([
  // Creative Specialist (Sprint C1)
  'generate_creative',
  'iterate_creative',
  'vary_creative',
  'adapt_creative',
  'compare_creatives',
  // Compliance Officer (Sprint C2)
  'add_prohibition',
  'rescan_compliance',
  'get_compliance_status',
  // Action Manager (Sprint C3)
  'pause_campaign',
  'reactivate_campaign',
  'pause_ad',
  'reactivate_ad',
  'update_budget',
  'propose_plan',
]);

/**
 * Subset de CHAT_TOOLS que o orchestrator (ai-chat) expoe ao LLM.
 * Tools "owned" por specialists ficam de fora — o LLM precisa usar
 * delegate_to_<specialist> em vez de chamar direto.
 */
export const ORCHESTRATOR_TOOLS = CHAT_TOOLS.filter(
  (t) => !SPECIALIST_OWNED_TOOLS.has(t.function.name),
);
