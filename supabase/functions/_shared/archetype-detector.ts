// Archetype detector — heuristica por keywords (camada 1) + LLM fallback (camada 2)
// + orquestrador `detectArchetype`.
// Spec: business-archetype-personas (tasks 3.1, 3.2, 3.3)
//
// NOTA: Edge Functions rodam em Deno e nao conseguem importar do `src/`.
// Por isso o type `Archetype` e redeclarado aqui (espelha
// `src/types/business-archetype.ts` e `_shared/archetype-reader.ts`).
// Se voce alterar um lado, atualize os outros.

export const ARCHETYPE_VALUES = [
  'small_local_business',
  'online_seller',
  'service_provider',
  'info_product',
] as const;

export type Archetype = typeof ARCHETYPE_VALUES[number];

export type PrimaryOfferFormat = 'course' | 'service' | 'physical' | 'saas' | 'other';

export interface DetectorInput {
  niche?: string | null;
  niche_category?: string | null;
  short_description?: string | null;
  primary_offer_format?: PrimaryOfferFormat | null;
}

// ---------------------------------------------------------------------------
// Listas curadas de keywords (PT-BR, lowercase). Ver R-06 do research.
// Mantenha sintetico (~15-25 termos por lista). Termos muito genericos
// ("loja", "site") sao evitados pra reduzir overlap entre listas.
// ---------------------------------------------------------------------------

export const KEYWORDS_SMALL_LOCAL: readonly string[] = [
  'padaria',
  'restaurante',
  'salao de beleza',
  'salão de beleza',
  'barbearia',
  'pizzaria',
  'lanchonete',
  'mercadinho',
  'mercearia',
  'papelaria',
  'oficina',
  'pet shop',
  'petshop',
  'acougue',
  'açougue',
  'hortifruti',
  'farmacia',
  'farmácia',
  'clinica local',
  'academia de bairro',
  'sorveteria',
  'cafeteria',
  'loja de bairro',
  'manicure',
  'estetica facial',
];

export const KEYWORDS_ONLINE_SELLER: readonly string[] = [
  'loja online',
  'loja virtual',
  'ecommerce',
  'e-commerce',
  'dropshipping',
  'drop shipping',
  'marketplace',
  'shopify',
  'nuvemshop',
  'nuvem shop',
  'mercado livre',
  'shopee',
  'vendas online',
  'frete',
  'carrinho',
  'envio nacional',
  'bijuteria online',
  'roupas online',
  'moda online',
  'site de vendas',
  'tray commerce',
  'woocommerce',
  'produto fisico envio',
];

export const KEYWORDS_SERVICE_PROVIDER: readonly string[] = [
  'consultoria',
  'advogado',
  'advocacia',
  'contador',
  'contabilidade',
  'dentista',
  'odontologia',
  'psicologo',
  'psicólogo',
  'psicologa',
  'psicóloga',
  'eletricista',
  'encanador',
  'designer',
  'agencia de marketing',
  'agência de marketing',
  'freelancer',
  'prestador de servico',
  'prestador de serviço',
  'agendamento',
  'orcamento',
  'orçamento',
  'arquiteto',
  'fisioterapeuta',
  'corretor de imoveis',
  'corretor de imóveis',
  'manutencao',
  'manutenção',
  'reparo',
];

export const KEYWORDS_INFO_PRODUCT: readonly string[] = [
  'curso online',
  'curso digital',
  'infoproduto',
  'info produto',
  'ebook',
  'e-book',
  'mentoria',
  'treinamento online',
  'aula online',
  'aulas online',
  'masterclass',
  'workshop online',
  'plr',
  'hotmart',
  'eduzz',
  'monetizze',
  'kiwify',
  'lancamento digital',
  'lançamento digital',
  'coaching',
  'metodo passo a passo',
  'método passo a passo',
  'comunidade paga',
];

// ---------------------------------------------------------------------------
// matchByKeyword
// ---------------------------------------------------------------------------

function containsAny(haystack: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (n && haystack.includes(n)) return true;
  }
  return false;
}

/**
 * Ordem importa: info_product PRIMEIRO pra evitar que "curso de bijuteria
 * online" caia em online_seller pelo termo "bijuteria online". A presenca de
 * "curso online" deve ganhar de qualquer outro indicador.
 *
 * Service_provider vem depois de info_product porque "consultoria" aparece
 * nas duas (consultoria como servico vs "consultoria online" como produto
 * digital), e queremos que info_product ganhe quando o termo for explicito
 * de produto digital.
 *
 * Online_seller vem antes de small_local_business porque keywords de
 * e-commerce sao mais especificas (e portanto mais confiaveis) do que
 * "padaria"/"restaurante" que tambem podem ter operacao online.
 */
const SCAN_ORDER: ReadonlyArray<{ archetype: Archetype; keywords: readonly string[] }> = [
  { archetype: 'info_product', keywords: KEYWORDS_INFO_PRODUCT },
  { archetype: 'online_seller', keywords: KEYWORDS_ONLINE_SELLER },
  { archetype: 'service_provider', keywords: KEYWORDS_SERVICE_PROVIDER },
  { archetype: 'small_local_business', keywords: KEYWORDS_SMALL_LOCAL },
];

/**
 * Heuristica de classificacao por keywords. Retorna o primeiro arquetipo
 * encontrado segundo a ordem de prioridade documentada.
 *
 * Prioridade dos sinais:
 *   1. primary_offer_format (mais confiavel — selecionado pelo usuario)
 *      - 'course'   -> info_product
 *      - 'service'  -> service_provider
 *      - 'physical' -> small_local_business
 *      - 'saas'/'other' -> ignorado, segue pra niche
 *   2. niche + niche_category (curado/tagged pelo usuario)
 *   3. short_description (texto livre, mais ruidoso)
 *
 * Em qualquer dos passos 2/3 a varredura segue SCAN_ORDER.
 *
 * Retorna null se nada bater — caller deve cair pro LLM (task 3.2).
 */
export function matchByKeyword(input: DetectorInput): Archetype | null {
  // Passo 1: primary_offer_format
  switch (input.primary_offer_format) {
    case 'course':
      return 'info_product';
    case 'service':
      return 'service_provider';
    case 'physical':
      return 'small_local_business';
    // 'saas' e 'other' nao mapeiam diretamente — tenta keywords
    default:
      break;
  }

  const niche = (input.niche ?? '').toLowerCase();
  const nicheCat = (input.niche_category ?? '').toLowerCase();
  const desc = (input.short_description ?? '').toLowerCase();

  // Passo 2: niche + niche_category concatenados
  const nicheBlob = `${niche} ${nicheCat}`.trim();
  if (nicheBlob.length > 0) {
    for (const { archetype, keywords } of SCAN_ORDER) {
      if (containsAny(nicheBlob, keywords)) return archetype;
    }
  }

  // Passo 3: short_description
  if (desc.length > 0) {
    for (const { archetype, keywords } of SCAN_ORDER) {
      if (containsAny(desc, keywords)) return archetype;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// isArchetype guard (espelha o helper de `archetype-reader.ts`)
// ---------------------------------------------------------------------------

export function isArchetype(v: unknown): v is Archetype {
  return typeof v === 'string' && (ARCHETYPE_VALUES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// classifyViaLLM — fallback camada 2 (Task 3.2)
// ---------------------------------------------------------------------------

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = 'gpt-4o-mini';
const LLM_TIMEOUT_MS = 8000;

/**
 * Fallback de classificacao via gpt-4o-mini com response_format=json_object.
 *
 * Retorna null em qualquer falha (sem API key, timeout, network error,
 * JSON invalido, valor fora do enum). Caller deve tratar null como
 * "nao foi possivel classificar".
 */
export async function classifyViaLLM(input: DetectorInput): Promise<Archetype | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.warn('[archetype-detector] OPENAI_API_KEY ausente — pulando LLM fallback');
    return null;
  }

  const niche = (input.niche ?? '').slice(0, 200);
  const nicheCat = (input.niche_category ?? '').slice(0, 200);
  const desc = (input.short_description ?? '').slice(0, 500);

  const userPrompt =
    `Classifique este negócio em UM dos 4 arquétipos: ` +
    `small_local_business | online_seller | service_provider | info_product. ` +
    `Negócio: niche='${niche}', categoria='${nicheCat}', descrição='${desc}'. ` +
    `Responda no formato {"archetype": "..."}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 50,
        messages: [
          { role: 'system', content: 'Você é um classificador de negócios. Responda APENAS JSON válido.' },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn('[archetype-detector] LLM HTTP nao-ok', { status: res.status });
      return null;
    }

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      console.warn('[archetype-detector] LLM resposta sem content string');
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn('[archetype-detector] LLM JSON parse fail', { content: content.slice(0, 200) });
      return null;
    }

    const value = (parsed as { archetype?: unknown })?.archetype;
    if (!isArchetype(value)) {
      console.warn('[archetype-detector] LLM retornou valor invalido', { value });
      return null;
    }

    return value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[archetype-detector] LLM erro', { error: msg });
    return null;
  }
}

// ---------------------------------------------------------------------------
// detectArchetype — orquestrador (Task 3.3)
// ---------------------------------------------------------------------------

export type DetectionResult =
  | { method: 'keyword'; archetype: Archetype; confidence: number }
  | { method: 'llm'; archetype: Archetype; confidence: number }
  | { method: 'failed'; archetype: null; confidence: 0 }
  | { method: 'skipped'; archetype: Archetype; confidence: number };

/**
 * Tenta keyword first; se nao bater, cai pro LLM. Retorna sempre um
 * DetectionResult discriminado por `method`.
 *
 * Confidence: 0.85 pra keyword (sinal mais forte/curado),
 * 0.6 pra LLM (heuristica generica). 'skipped' e produzido pelo edge fn
 * (idempotencia) e nao por esta funcao.
 */
export async function detectArchetype(input: DetectorInput): Promise<DetectionResult> {
  const kw = matchByKeyword(input);
  if (kw !== null) {
    return { method: 'keyword', archetype: kw, confidence: 0.85 };
  }

  const llm = await classifyViaLLM(input);
  if (llm !== null) {
    return { method: 'llm', archetype: llm, confidence: 0.6 };
  }

  return { method: 'failed', archetype: null, confidence: 0 };
}
