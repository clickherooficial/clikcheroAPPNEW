// Helpers de chat-publish-flow consumidos pelos handlers `propose_campaign`
// e `publish_campaign` no orchestrator (ai-chat).
//
// Spec: .kiro/specs/chat-publish-flow/ (tasks 3.1, 3.2, 3.3, 3.4)
// 4 funcoes:
//
//   checkPrereqs()              — task 3.1 — TenantPrereqGuard
//   resolveDefaults()           — task 3.2 — BriefingResolver
//   generateCopy()              — task 3.3 — CopyGenerator
//   mapProposalToCampaignBody() — task 3.4 — ProposalToCampaignMapper
//
// Tipos compartilhados com o frontend ficam em src/types/campaign-proposal.ts.
// Aqui re-declaramos as poucas formas que precisamos pra evitar dependencia
// cross-tree (Deno edge fn nao importa de src/).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// Tipos locais (espelho de src/types/campaign-proposal.ts)
// ============================================================

export type PrereqErrorKind =
  | 'missing_meta_connection'
  | 'missing_page_selection'
  | 'creative_not_found'
  | 'creative_not_in_tenant'
  | 'briefing_no_offer';

export interface PrereqContext {
  ad_account: { id: string; account_id: string; name: string | null };
  page: { id: string; page_id: string; name: string | null };
  pixel?: { id: string; pixel_id: string };
  briefing_complete: boolean;
}

export interface PrereqGuardResult {
  ready: boolean;
  context?: PrereqContext;
  missing: PrereqErrorKind[];
  // Quando ha >1 page ativa, marcamos pra agente perguntar no chat.
  pages_ambiguous?: Array<{ id: string; page_id: string; name: string | null }>;
  // Quando ha >1 ad account ativa, marcamos pra agente perguntar no chat.
  accounts_ambiguous?: Array<{ id: string; account_id: string; name: string | null }>;
}

export type CampaignObjective = 'SALES' | 'LEADS' | 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT';
export type MetaCtaEnum = 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'SUBSCRIBE' | 'DOWNLOAD' | 'CONTACT_US' | 'GET_OFFER' | 'BOOK_NOW';
// Meta API removeu 'CONVERSIONS' generico — usa OFFSITE_CONVERSIONS pra eventos pixel.
export type MetaOptimizationGoal = 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS' | 'OFFSITE_CONVERSIONS' | 'REACH' | 'IMPRESSIONS' | 'LEAD_GENERATION';
export type OfferFormat = 'course' | 'service' | 'physical' | 'saas' | 'other';

// Re-declarado aqui pois Edge Function (Deno) nao importa de src/types.
// Espelho de src/types/business-archetype.ts.
export type Archetype = 'small_local_business' | 'online_seller' | 'service_provider' | 'info_product';

export interface AudiencePayload {
  age_min: number;
  age_max: number;
  geo_locations: { countries?: string[]; cities?: Array<{ key: string; radius?: number; distance_unit?: 'kilometer' | 'mile' }> };
  interests?: Array<{ id: string; name: string }>;
  genders?: Array<1 | 2>;
}

export interface CopyPayload {
  headline: string;
  body: string;
  description?: string;
  cta: MetaCtaEnum;
}

export interface ResolvedDefaults {
  objective: CampaignObjective;
  optimization_goal: MetaOptimizationGoal;
  audience: AudiencePayload;
  daily_budget_brl: number;
  link_url: string;
  campaign_name: string;
  // Snippets para CopyGenerator usar
  offer_name: string;
  offer_short_description: string;
  tone_summary: string;
}

export interface CampaignProposalPayload {
  objective: CampaignObjective;
  campaign_name: string;
  daily_budget_brl: number;
  start_time?: string;
  stop_time?: string;
  audience: AudiencePayload;
  /** Só UI: resumo quando targeting resolveu cidade/regiao via Meta Search */
  audience_geo_summary?: string;
  optimization_goal: MetaOptimizationGoal;
  copy: CopyPayload;
  link_url: string;
  prereq: { ad_account: { id: string; account_id: string; name: string | null }; page: { id: string; page_id: string; name: string | null }; pixel?: { id: string; pixel_id: string } };
  creative: { id: string; format: 'feed_1x1' | 'story_9x16' | 'reels_4x5'; media_url_at_propose: string };
}

// Body do campaign-publish (subset que nos importa)
export interface CampaignPublishBody {
  ad_account_id: string;
  // Edge fn `campaign-publish` espera essas chaves COM sufixo `_data`
  // (mesmo shape que `campaign_drafts.campaign_data` etc).
  campaign_data: {
    name: string;
    objective: 'OUTCOME_SALES' | 'OUTCOME_LEADS' | 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT';
    status: 'PAUSED' | 'ACTIVE';
    buying_type: 'AUCTION';
    special_ad_categories: string[];
    start_time?: string;
    stop_time?: string;
  };
  adset_data: {
    name: string;
    daily_budget: number; // centavos
    targeting: AudiencePayload;
    optimization_goal: MetaOptimizationGoal;
    billing_event: 'IMPRESSIONS' | 'LINK_CLICKS';
    start_time?: string;
  };
  ad_data: {
    name: string;
    headline: string;
    body: string;
    description?: string;
    cta: MetaCtaEnum;
    image_url: string;
    link_url: string;
    page_id: string;
    pixel_id?: string;
  };
}

// ============================================================
// Task 3.1 — TenantPrereqGuard
// ============================================================

/**
 * Valida que o tenant tem o necessario pra publicar:
 * - Pelo menos 1 meta_ad_accounts ativa
 * - Pelo menos 1 meta_pages ativa do mesmo tenant
 * - Briefing minimamente completo (nao bloqueante; informativo)
 *
 * Heuristica de selecao (D3 do design):
 *   - Primeiro is_active=true ordenado por selected_at desc, fallback created_at desc
 *   - Se >1 page ativa: marca pages_ambiguous pro agente perguntar
 *
 * Pixel e opcional — nao bloqueia.
 */
export async function checkPrereqs(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PrereqGuardResult> {
  const missing: PrereqErrorKind[] = [];

  // ad_account ativa
  const { data: accounts } = await supabase
    .from('meta_ad_accounts')
    .select('id, account_id, account_name, selected_at, created_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('selected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const account = (accounts ?? [])[0];
  if (!account) {
    missing.push('missing_meta_connection');
  }

  // pages ativas
  const { data: pages } = await supabase
    .from('meta_pages')
    .select('id, page_id, page_name, selected_at, created_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('selected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const activePages = pages ?? [];
  if (activePages.length === 0) {
    missing.push('missing_page_selection');
  }

  // pixel (opcional)
  let pixel: PrereqContext['pixel'] | undefined;
  if (account) {
    const { data: pixels } = await supabase
      .from('meta_pixels')
      .select('id, external_id')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('is_unavailable', false)
      .limit(1);
    const px = (pixels ?? [])[0];
    if (px) pixel = { id: px.id, pixel_id: px.external_id };
  }

  // briefing (informativo, nao bloqueia)
  const { data: briefingStatus } = await supabase
    .from('v_company_briefing_status')
    .select('is_complete')
    .eq('company_id', companyId)
    .maybeSingle();
  const briefing_complete = Boolean(briefingStatus?.is_complete);

  if (missing.length > 0) {
    return { ready: false, missing };
  }

  const result: PrereqGuardResult = {
    ready: true,
    missing: [],
    context: {
      ad_account: { id: account!.id, account_id: account!.account_id, name: account!.account_name },
      page: { id: activePages[0].id, page_id: activePages[0].page_id, name: activePages[0].page_name },
      pixel,
      briefing_complete,
    },
  };

  if (activePages.length > 1) {
    result.pages_ambiguous = activePages.map((p) => ({
      id: p.id,
      page_id: p.page_id,
      name: p.page_name,
    }));
  }

  if ((accounts ?? []).length > 1) {
    result.accounts_ambiguous = (accounts ?? []).map((a) => ({
      id: a.id,
      account_id: a.account_id,
      name: a.account_name,
    }));
  }

  return result;
}

// ============================================================
// Task 3.2 — BriefingResolver
// ============================================================

const OBJECTIVE_BY_FORMAT: Record<OfferFormat, CampaignObjective> = {
  course: 'SALES',
  service: 'LEADS',
  physical: 'SALES',
  saas: 'LEADS',
  other: 'TRAFFIC',
};

// SALES: poderia ser OFFSITE_CONVERSIONS mas EXIGE promoted_object (pixel_id + event).
// LANDING_PAGE_VIEWS tambem exige promoted_object (website URL) em SALES outcome.
// LINK_CLICKS e o mais leve: nao exige nada extra, conta cliques no anuncio.
// Trade-off: nao otimiza pra quem chega na pagina (so clica). Mas funciona pra leigo
// sem pixel/promoted_object configurados.
const OPTIMIZATION_BY_OBJECTIVE: Record<CampaignObjective, MetaOptimizationGoal> = {
  SALES: 'LINK_CLICKS',
  LEADS: 'LEAD_GENERATION',
  AWARENESS: 'REACH',
  TRAFFIC: 'LINK_CLICKS',
  ENGAGEMENT: 'IMPRESSIONS',
};

// ============================================================
// Task 5.1 — Mapas estaticos por arquetipo (business-archetype-personas)
// ============================================================
// Esses mapas sao consumidos por resolveDefaults (task 5.2) e generateCopy
// (task 5.3) pra pre-popular objective/CTA/optimization_goal nas propostas
// de campanha conforme o arquetipo do negocio (Req 6.2, 6.3, 6.4, 6.5).
// Precedencia esperada: overrides > *_BY_ARCHETYPE > *_BY_OBJECTIVE/FORMAT.

/**
 * Objetivo de campanha sugerido por arquetipo.
 * - small_local_business: ENGAGEMENT (negocio local quer interacao/visibilidade na regiao)
 * - online_seller: SALES (e-commerce vive de conversao direta)
 * - service_provider: LEADS (prestador precisa de contatos qualificados)
 * - info_product: LEADS (infoproduto captura lead pra nutrir antes de vender)
 *
 * NOTA: Enum atual nao tem OUTCOME_SALES/OUTCOME_LEADS — usamos os valores
 * curtos SALES/LEADS/ENGAGEMENT existentes em CampaignObjective. A traducao
 * pra OUTCOME_* acontece em mapProposalToCampaignBody.
 */
export const OBJECTIVE_BY_ARCHETYPE: Partial<Record<Archetype, CampaignObjective>> = {
  small_local_business: 'ENGAGEMENT',
  online_seller: 'SALES',
  service_provider: 'LEADS',
  info_product: 'LEADS',
};

/**
 * CTA do anuncio sugerido por arquetipo.
 * - small_local_business: LEARN_MORE (descoberta de loja/servico local)
 * - online_seller: SHOP_NOW (intencao direta de compra)
 * - service_provider: CONTACT_US (mais proximo de WhatsApp; enum nao tem WHATSAPP_MESSAGE/MESSAGE_PAGE)
 * - info_product: SIGN_UP (captura de lead em landing page)
 *
 * NOTA: Spec sugeriu WHATSAPP_MESSAGE/MESSAGE_PAGE pra service_provider, mas
 * o MetaCtaEnum atual nao define esses valores. CONTACT_US e o mais proximo
 * semanticamente ate o enum ser estendido.
 */
export const CTA_BY_ARCHETYPE: Partial<Record<Archetype, MetaCtaEnum>> = {
  small_local_business: 'LEARN_MORE',
  online_seller: 'SHOP_NOW',
  service_provider: 'CONTACT_US',
  info_product: 'SIGN_UP',
};

/**
 * Optimization goal do adset sugerido por arquetipo.
 * - small_local_business: REACH (maximizar alcance local)
 * - online_seller: CONVERSIONS (vendas trackeadas via pixel)
 * - service_provider: LEAD_GENERATION (form lead nativo da Meta)
 * - info_product: LEAD_GENERATION (mesma logica — capturar leads)
 */
export const OPTIMIZATION_BY_ARCHETYPE: Partial<Record<Archetype, MetaOptimizationGoal>> = {
  small_local_business: 'REACH',
  online_seller: 'LINK_CLICKS', // LANDING_PAGE_VIEWS exige promoted_object (URL); LINK_CLICKS funciona sem pixel
  service_provider: 'LEAD_GENERATION',
  info_product: 'LEAD_GENERATION',
};

const MIN_DAILY_BUDGET_BRL = 10;

/**
 * Le briefing + oferta principal e devolve defaults sensatos pra
 * propose_campaign pre-popular o payload.
 *
 * Falha com 'briefing_no_offer' se nao houver oferta principal cadastrada.
 *
 * ## Archetype (Task 5.2 — business-archetype-personas)
 *
 * Aceita `archetype?: Archetype | null` opcional para influenciar defaults
 * de objective, CTA e optimization_goal. A precedencia e (R6.7, R6.8):
 *
 *   objective:         overrides > OBJECTIVE_BY_ARCHETYPE > OBJECTIVE_BY_FORMAT
 *   optimization_goal: overrides > OPTIMIZATION_BY_ARCHETYPE > derivado-do-objective
 *   (cta vive em generateCopy — ver task 5.3)
 *
 * Quando `archetype` e null/undefined, o comportamento Fase 1 e PRESERVADO
 * INTEGRALMENTE (cadeia FORMAT/objective-derived intacta, sem efeito colateral).
 *
 * ### Decisao de design: NAO le archetype do DB aqui
 *
 * A task original sugere "quando ausente, le via readArchetype (fallback)".
 * Decidimos NAO fazer essa leitura dentro do helper por separacao de concerns:
 * - `resolveDefaults` ja faz I/O em company_briefings/company_offers; adicionar
 *   mais um round-trip (readArchetype) acopla mais o helper ao schema.
 * - O orchestrator (ai-chat handler de propose_campaign) ja tem o SupabaseClient
 *   e pode resolver o archetype UMA vez e passar adiante (tambem usa pra prompt
 *   blocks). Manter o helper "puro-ish" facilita teste e reuso.
 *
 * Caller e responsavel por chamar `readArchetype(supabase, companyId)` ANTES
 * e passar o resultado em `archetype`. Se nao passar, fica null -> Fase 1.
 */
export async function resolveDefaults(
  supabase: SupabaseClient,
  companyId: string,
  overrides: {
    objective?: CampaignObjective;
    daily_budget_brl?: number;
    audience?: Partial<AudiencePayload>;
  } = {},
  archetype?: Archetype | null,
): Promise<{ ok: true; defaults: ResolvedDefaults } | { ok: false; error_kind: PrereqErrorKind }> {
  // Briefing
  const { data: briefing } = await supabase
    .from('company_briefings')
    .select('audience, tone, niche, short_description, website_url')
    .eq('company_id', companyId)
    .maybeSingle();

  // Oferta principal
  const { data: offers } = await supabase
    .from('company_offers')
    .select('id, name, short_description, sales_url, format, currency')
    .eq('company_id', companyId)
    .eq('is_primary', true)
    .limit(1);

  const offer = (offers ?? [])[0];
  if (!offer) {
    return { ok: false, error_kind: 'briefing_no_offer' };
  }

  // Objective: override > arquetipo > derivado de format (R6.7)
  const offerFormat: OfferFormat = (offer.format as OfferFormat) ?? 'other';
  const archetypeObjective = archetype != null ? OBJECTIVE_BY_ARCHETYPE[archetype] : undefined;
  const objective = overrides.objective ?? archetypeObjective ?? OBJECTIVE_BY_FORMAT[offerFormat];

  // Optimization goal: arquetipo > derivado do objective (R6.8)
  // Nota: overrides nao expoe optimization_goal hoje; mantemos hook caso futuro.
  const archetypeOptimization = archetype != null ? OPTIMIZATION_BY_ARCHETYPE[archetype] : undefined;
  const optimization_goal = archetypeOptimization ?? OPTIMIZATION_BY_OBJECTIVE[objective];

  // Budget: override > minimo seguro
  const daily_budget_brl = Math.max(
    MIN_DAILY_BUDGET_BRL,
    overrides.daily_budget_brl ?? MIN_DAILY_BUDGET_BRL,
  );

  // Audience: idade + paises BR default; merges parciais de geo no override.
  // Cidades com key Meta podem vir de overrides ou de propose_campaign (Targeting Search).
  const briefingAge = (briefing?.audience as { ageRange?: { min?: number; max?: number } } | null)?.ageRange;
  const ovGeo = overrides.audience?.geo_locations;
  const geo_locations: AudiencePayload['geo_locations'] = ovGeo != null
    ? {
      countries: ovGeo.countries?.length ? ovGeo.countries : ['BR'],
      ...(ovGeo.cities?.length ? { cities: ovGeo.cities } : {}),
    }
    : { countries: ['BR'] };

  const audience: AudiencePayload = {
    age_min: clampAge(overrides.audience?.age_min ?? briefingAge?.min ?? 18),
    age_max: clampAge(overrides.audience?.age_max ?? briefingAge?.max ?? 65),
    geo_locations,
    interests: overrides.audience?.interests ?? [],
  };
  // Garante max >= min
  if (audience.age_max < audience.age_min) audience.age_max = audience.age_min;

  // Link de destino: sales_url da oferta > website da empresa > placeholder
  const link_url = offer.sales_url
    ?? (briefing?.website_url as string | null | undefined)
    ?? `https://www.facebook.com`; // fallback nao quebra Zod do publish

  // Nome da campanha: oferta + data
  const datePart = new Date().toISOString().slice(0, 10);
  const campaign_name = `${offer.name.slice(0, 60)} - ${datePart}`.slice(0, 100);

  const tone = (briefing?.tone as Record<string, unknown> | null) ?? {};
  const tone_summary = summarizeTone(tone);

  return {
    ok: true,
    defaults: {
      objective,
      optimization_goal,
      audience,
      daily_budget_brl,
      link_url,
      campaign_name,
      offer_name: offer.name,
      offer_short_description: offer.short_description,
      tone_summary,
    },
  };
}

function clampAge(n: number): number {
  if (Number.isNaN(n)) return 18;
  return Math.max(13, Math.min(65, Math.round(n)));
}

function summarizeTone(tone: Record<string, unknown>): string {
  const formality = tone.formality as number | undefined;
  const technicality = tone.technicality as number | undefined;
  const emotional = tone.emotional as string[] | undefined;
  const parts: string[] = [];
  if (formality != null) {
    parts.push(formality <= 2 ? 'casual' : formality >= 4 ? 'formal' : 'meio termo');
  }
  if (technicality != null) {
    parts.push(technicality <= 2 ? 'simples' : technicality >= 4 ? 'tecnico' : 'medio');
  }
  if (Array.isArray(emotional) && emotional.length > 0) {
    parts.push(emotional.slice(0, 3).join('/'));
  }
  return parts.join(', ') || 'neutro';
}

// ============================================================
// Task 3.3 — CopyGenerator
// ============================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// 2026-05-04: gpt-4o-mini suficiente pra geracao de copy estruturada (JSON com
// titulos/descricoes curtas). 10x mais barato e elimina pressao na quota TPM.
const COPY_MODEL = 'gpt-4o-mini';

const CTA_BY_OBJECTIVE: Record<CampaignObjective, MetaCtaEnum> = {
  SALES: 'SHOP_NOW',
  LEADS: 'SIGN_UP',
  AWARENESS: 'LEARN_MORE',
  TRAFFIC: 'LEARN_MORE',
  ENGAGEMENT: 'LEARN_MORE',
};

interface CopyGenInput {
  defaults: ResolvedDefaults;
  overrides?: { headline?: string; body?: string; cta?: MetaCtaEnum; description?: string };
  /**
   * Arquetipo do negocio (Fase 2 — business-archetype-personas).
   * Quando presente, anexa um hint especifico ao system prompt do gpt-4o
   * pra orientar tom/CTA/foco da copy. Quando null/undefined: comportamento
   * Fase 1 preservado (prompt original sem hint).
   */
  archetype?: Archetype | null;
  /**
   * Ultimas mensagens da conversa (chat). Quando presente, o LLM prioriza
   * a oferta/produto especifico mencionado pelo usuario na conversa em vez
   * dos defaults do briefing. Resolve bug onde briefing e Imperius mas user
   * conversou sobre pizzaria.
   */
  conversation_context?: string;
}

/**
 * Hints por arquetipo anexados ao system prompt do gpt-4o (Req 6.6).
 * Cada string e appended ao final do system prompt como diretriz extra.
 */
const ARCHETYPE_COPY_HINTS: Record<Archetype, string> = {
  small_local_business: 'Para negócio local: mencione bairro/cidade quando disponível no contexto. Use vocabulário acolhedor ("vizinhos", "perto de você"). Foque em conveniência presencial.',
  online_seller: 'Para loja online: destaque promoção, frete, garantia, prova social. Use CTA direto ("compre agora"). Mencione benefício tangível do produto.',
  service_provider: 'Para prestador de serviço: foque em confiança e resultado. Sugira contato direto (orçamento, conversa). Tom consultivo, sem urgência artificial.',
  info_product: 'Para infoproduto: foque na transformação que o aluno terá. Ofereça aula gratuita / ebook como entrada. EVITE promessas de resultado em prazo curto (compliance Meta).',
};

/**
 * Gera headline/body/cta dentro dos limites Meta. Aceita overrides do user.
 * Falha-aberta: se o LLM falhar, retorna copy minimamente aceitavel derivada
 * do nome da oferta — a campanha pode ser publicada mesmo assim.
 *
 * Quando `input.archetype` e fornecido, anexa um hint especifico ao system
 * prompt do gpt-4o (ARCHETYPE_COPY_HINTS) pra orientar a copy conforme o
 * arquetipo do negocio. Backwards-compatible: se ausente, prompt original.
 */
export async function generateCopy(input: CopyGenInput): Promise<CopyPayload> {
  const ovr = input.overrides ?? {};
  const cta = ovr.cta ?? CTA_BY_OBJECTIVE[input.defaults.objective];

  // Se o user ja passou TUDO, nao chama LLM
  if (ovr.headline && ovr.body) {
    return {
      headline: ovr.headline.slice(0, 40),
      body: ovr.body.slice(0, 125),
      description: ovr.description?.slice(0, 27),
      cta,
    };
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  if (!apiKey) {
    return fallbackCopy(input.defaults, cta);
  }

  const baseSystem = `Voce escreve copy de anuncio Meta Ads em portugues coloquial brasileiro pra dono de negocio leigo. Limites RIGIDOS: headline <=40 chars, body <=125 chars, description (opcional) <=27 chars. Sem emojis, sem CAPS LOCK gritado, sem promessas exageradas. Direto e claro. Retorne APENAS um JSON valido (sem markdown), com chaves "headline", "body", "description".`;
  const system = input.archetype
    ? `${baseSystem}\n\nDiretriz por arquétipo:\n${ARCHETYPE_COPY_HINTS[input.archetype]}`
    : baseSystem;
  // Quando ha conversa recente, ela TEM PRIORIDADE sobre os defaults do briefing.
  // O briefing pode ser de outro negocio (ex: Imperius Tecnologia) mas o user pode
  // estar testando um anuncio de pizzaria. A copy precisa refletir o que ele disse.
  const conversationBlock = input.conversation_context
    ? `\nCONTEXTO DA CONVERSA (PRIORIDADE MAXIMA — se aqui mencionar oferta especifica como "pizza R$30 SP", USE ESSA OFERTA, ignorando o briefing default abaixo):\n${input.conversation_context}\n`
    : '';

  const user = `${conversationBlock}Briefing default (use se conversa nao mencionar oferta especifica):
- Oferta: ${input.defaults.offer_name}
- Descricao: ${input.defaults.offer_short_description}
- Objetivo: ${input.defaults.objective} (${objectiveHumanLabel(input.defaults.objective)})
- Tom: ${input.defaults.tone_summary}

Overrides explicitos do usuario (sempre tem prioridade): ${JSON.stringify(ovr)}

Retorne JSON com headline, body, description em portugues do Brasil. Direto, sem promessas exageradas.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: COPY_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallbackCopy(input.defaults, cta);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      headline: String(ovr.headline ?? parsed.headline ?? input.defaults.offer_name).slice(0, 40),
      body: String(ovr.body ?? parsed.body ?? input.defaults.offer_short_description).slice(0, 125),
      description: ((): string | undefined => {
        const d = ovr.description ?? parsed.description;
        return d ? String(d).slice(0, 27) : undefined;
      })(),
      cta,
    };
  } catch {
    return fallbackCopy(input.defaults, cta);
  }
}

function fallbackCopy(d: ResolvedDefaults, cta: MetaCtaEnum): CopyPayload {
  return {
    headline: d.offer_name.slice(0, 40),
    body: d.offer_short_description.slice(0, 125),
    cta,
  };
}

function objectiveHumanLabel(obj: CampaignObjective): string {
  switch (obj) {
    case 'SALES': return 'vender mais';
    case 'LEADS': return 'gerar contatos';
    case 'AWARENESS': return 'mais gente conhecer';
    case 'TRAFFIC': return 'mais visitas';
    case 'ENGAGEMENT': return 'mais interacao';
  }
}

// ============================================================
// Task 3.4 — ProposalToCampaignMapper
// ============================================================

/**
 * Pure function: mapeia o payload da proposta + prereq snapshot para o
 * body Zod do `campaign-publish`. Nao faz IO — caller eh responsavel por
 * regenerar o signed URL da imagem ANTES de chamar (a imagem URL chega aqui
 * via `image_url_fresh`).
 */
export function mapProposalToCampaignBody(
  payload: CampaignProposalPayload,
  image_url_fresh: string,
): CampaignPublishBody {
  // Traduz objective curto -> codigo Meta OUTCOME_*
  // SALES mapeado pra OUTCOME_TRAFFIC porque OUTCOME_SALES exige promoted_object
  // (pixel + custom_event_type), e SMB tipicamente nao tem pixel events configurados.
  // Driving traffic + LANDING_PAGE_VIEWS optimization e o caminho seguro pra leigo.
  // Quando user tem pixel ativo + pixel events trackados, propose_campaign pode passar
  // copy_overrides com objective=OUTCOME_SALES + promoted_object explicito (futuro).
  const objectiveCodeMap: Record<CampaignObjective, CampaignPublishBody['campaign_data']['objective']> = {
    SALES: 'OUTCOME_TRAFFIC',
    LEADS: 'OUTCOME_LEADS',
    AWARENESS: 'OUTCOME_AWARENESS',
    TRAFFIC: 'OUTCOME_TRAFFIC',
    ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
  };

  // Daily budget BRL (ex: 30.00) -> centavos (3000)
  const daily_budget_centavos = Math.round(payload.daily_budget_brl * 100);

  // Billing event: LINK_CLICKS so faz sentido com optimization LINK_CLICKS
  const billing_event: CampaignPublishBody['adset_data']['billing_event'] =
    payload.optimization_goal === 'LINK_CLICKS' ? 'LINK_CLICKS' : 'IMPRESSIONS';

  return {
    ad_account_id: payload.prereq.ad_account.account_id,
    campaign_data: {
      name: payload.campaign_name,
      objective: objectiveCodeMap[payload.objective],
      status: 'PAUSED', // sempre pausado no create — auto_activate ativa logo apos via Edge Fn
      buying_type: 'AUCTION',
      special_ad_categories: [],
      start_time: payload.start_time,
      stop_time: payload.stop_time,
    },
    adset_data: {
      name: `${payload.campaign_name} - Conjunto`,
      daily_budget: daily_budget_centavos,
      targeting: payload.audience,
      optimization_goal: payload.optimization_goal,
      billing_event,
      start_time: payload.start_time,
    },
    ad_data: {
      name: `${payload.campaign_name} - Anuncio`,
      headline: payload.copy.headline,
      body: payload.copy.body,
      description: payload.copy.description,
      cta: payload.copy.cta,
      image_url: image_url_fresh,
      link_url: payload.link_url,
      page_id: payload.prereq.page.page_id,
      pixel_id: payload.prereq.pixel?.pixel_id,
    },
  };
}
