// Handler da tool `propose_campaign` do orchestrator (ai-chat).
// Spec: chat-publish-flow (tasks 4.1, 4.2)
//
// Coleta dados (briefing, oferta, criativo), pre-preenche defaults,
// roda compliance preview, persiste em campaign_proposals com
// status='pending_approval' e devolve markdown contendo o placeholder
// `<campaign-proposal id="..."/>` que o ChatView renderiza como
// InlineCampaignProposalCard.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import {
  checkPrereqs,
  resolveDefaults,
  generateCopy,
  type CampaignObjective,
  type AudiencePayload,
  type MetaCtaEnum,
  type CampaignProposalPayload,
  type Archetype,
} from './campaign-proposal-helpers.ts';
import { runComplianceCheck, type ComplianceCheckResult } from './compliance-runner.ts';
import { resolveMetaContextByCompanyId } from './meta-edits-helpers.ts';
import { enrichAudienceWithLocalGeo, type BriefingAudienceShape } from './meta-geo-resolve.ts';

// ============================================================
// Validacao Zod do input (task 4.2)
// ============================================================

const InputSchema = z.object({
  creative_id: z.string().uuid('creative_id deve ser UUID'),
  objective: z.enum(['SALES', 'LEADS', 'AWARENESS', 'TRAFFIC', 'ENGAGEMENT']).optional(),
  daily_budget_brl: z.number().min(10, 'minimo R$10/dia').max(10000).optional(),
  audience_overrides: z.object({
    age_min: z.number().int().min(13).max(65).optional(),
    age_max: z.number().int().min(13).max(65).optional(),
    geo_locations: z.object({
      countries: z.array(z.string().length(2)).optional(),
      cities: z.array(z.object({
        key: z.string(),
        radius: z.number().optional(),
        distance_unit: z.enum(['kilometer', 'mile']).optional(),
      })).optional(),
    }).optional(),
  }).optional(),
  copy_overrides: z.object({
    headline: z.string().max(40).optional(),
    body: z.string().max(125).optional(),
    description: z.string().max(27).optional(),
    cta: z.enum(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'SUBSCRIBE', 'DOWNLOAD', 'CONTACT_US', 'GET_OFFER', 'BOOK_NOW']).optional(),
  }).optional(),
  page_id: z.string().optional(), // page_id OU nome parcial (resolve no handler)
  account_id: z.string().optional(), // ad account id OU nome parcial (resolve no handler)
  /** Texto livre (ex.: "Curitiba PR") — servidor resolve key Meta quando fizer sentido */
  local_geo_hint: z.string().max(120).trim().optional(),
});

export type ProposeCampaignInput = z.infer<typeof InputSchema>;

// ============================================================
// Handler
// ============================================================

export async function handleProposeCampaign(
  supabase: SupabaseClient,        // service-role (bypassa RLS pra INSERT)
  companyId: string,
  conversationId: string | null,
  userMessageId: string | null,
  args: unknown,
  archetype: Archetype | null = null, // Task 6.3: persona Fase 2 (null = Fase 1 puro)
): Promise<string> {
  // 1) Pre-processamento: trunca strings de copy_overrides aos limites Meta.
  // 2026-05-04: LLM (mesmo gpt-4o) gerava copy alguns chars acima do limite e
  // ficava em loop "vou ajustar a frase pra caber". Limites sao hard cap da
  // Meta — truncar server-side e melhor UX que rejeitar e re-invocar.
  if (args && typeof args === 'object' && 'copy_overrides' in args) {
    const co = (args as { copy_overrides?: Record<string, unknown> }).copy_overrides;
    if (co && typeof co === 'object') {
      const limits: Record<string, number> = { headline: 40, body: 125, description: 27 };
      for (const [field, max] of Object.entries(limits)) {
        const v = co[field];
        if (typeof v === 'string' && v.length > max) {
          co[field] = v.slice(0, max).trimEnd();
        }
      }
    }
  }

  // 2) Validacao do input
  const parsed = InputSchema.safeParse(args);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return `Erro de validacao em propose_campaign: ${fields}. Diga ao usuario LITERALMENTE: "Os dados que recebi nao estao no formato esperado, vou tentar de novo." e re-invoque a tool com os campos corretos.`;
  }
  const input = parsed.data;

  if (!conversationId) {
    return 'Erro interno: propose_campaign exige uma conversa ativa. Diga ao usuario que algo deu errado e ele pode tentar de novo.';
  }

  // 2) Validar criativo
  const { data: creative } = await supabase
    .from('creatives_generated')
    .select('id, company_id, format, storage_path')
    .eq('id', input.creative_id)
    .maybeSingle();

  if (!creative) {
    return 'Erro: o criativo referenciado nao foi encontrado. Diga ao usuario LITERALMENTE: "A imagem que eu ia usar nao esta mais disponivel. Quer gerar outra?"';
  }
  if (creative.company_id !== companyId) {
    return 'Erro: criativo pertence a outro tenant. Diga ao usuario que algo deu errado.';
  }

  // 3) Pre-requisitos do tenant
  const prereq = await checkPrereqs(supabase, companyId);
  if (!prereq.ready) {
    if (prereq.missing.includes('missing_meta_connection')) {
      return 'Pre-requisito faltando: tenant sem conexao Meta ativa. Diga ao usuario LITERALMENTE: "Voce precisa conectar sua conta Meta primeiro pra eu poder publicar. Posso te levar la?" e ofereca o link /integrations.';
    }
    if (prereq.missing.includes('missing_page_selection')) {
      return 'Pre-requisito faltando: nenhuma Pagina do Facebook selecionada. Diga ao usuario LITERALMENTE: "Eu preciso de uma Pagina do Facebook conectada pra rodar o anuncio. Vamos selecionar uma em /integrations?"';
    }
    return `Pre-requisito faltando: ${prereq.missing.join(', ')}.`;
  }
  const ctx = prereq.context!;

  // 3.1) Resolver page_id quando o user escolheu uma Pagina (handler aceita
  // page_id numerico OU nome / parte do nome — case-insensitive).
  if (input.page_id && prereq.pages_ambiguous && prereq.pages_ambiguous.length > 1) {
    const needle = input.page_id.trim().toLowerCase();
    const match = prereq.pages_ambiguous.find((p) =>
      p.page_id === input.page_id ||
      (p.name ?? '').toLowerCase().includes(needle)
    );
    if (match) {
      ctx.page = { id: match.id, page_id: match.page_id, name: match.name };
      prereq.pages_ambiguous = undefined;
    }
  }

  // 3.2) Resolver account_id quando o user escolheu uma Ad Account.
  if (input.account_id && prereq.accounts_ambiguous && prereq.accounts_ambiguous.length > 1) {
    const needle = input.account_id.trim().toLowerCase();
    const match = prereq.accounts_ambiguous.find((a) =>
      a.account_id === input.account_id ||
      (a.name ?? '').toLowerCase().includes(needle)
    );
    if (match) {
      ctx.ad_account = { id: match.id, account_id: match.account_id, name: match.name };
      prereq.accounts_ambiguous = undefined;
    }
  }

  // 3.3) Account ambigua: agente pergunta no chat antes de publicar
  if (prereq.accounts_ambiguous && prereq.accounts_ambiguous.length > 1) {
    const list = prereq.accounts_ambiguous.map((a) => `- ${a.name ?? a.account_id}`).join('\n');
    return `Voce tem mais de uma Conta de Anuncios Meta ativa. Pergunte ao usuario LITERALMENTE: "Qual conta de anuncios voce quer usar pra esse anuncio?" e liste:\n${list}\n\nQuando ele responder com o nome da conta, RE-INVOQUE propose_campaign com o parametro account_id contendo o que ele falou (nome ou account_id, match case-insensitive).`;
  }

  // 3.4) Page ambigua: agente pergunta no chat antes de publicar
  if (prereq.pages_ambiguous && prereq.pages_ambiguous.length > 1) {
    const list = prereq.pages_ambiguous.map((p) => `- ${p.name ?? p.page_id}`).join('\n');
    return `Voce tem mais de uma Pagina do Facebook ativa. Pergunte ao usuario LITERALMENTE: "Qual dessas Paginas voce quer usar pra esse anuncio?" e liste:\n${list}\n\nNao chame propose_campaign de novo ate o usuario escolher; quando ele responder com o nome da Pagina, RE-INVOQUE propose_campaign com o parametro page_id contendo o nome ou page_id que ele falou (ex: page_id="Vendedor Mestre").`;
  }

  // 4) Resolver defaults (briefing + oferta)
  const defaultsRes = await resolveDefaults(supabase, companyId, {
    objective: input.objective,
    daily_budget_brl: input.daily_budget_brl,
    audience: input.audience_overrides as Partial<AudiencePayload> | undefined,
  }, archetype);
  if (!defaultsRes.ok) {
    if (defaultsRes.error_kind === 'briefing_no_offer') {
      return 'Briefing sem oferta principal cadastrada. Diga ao usuario LITERALMENTE: "Antes de criar o anuncio, preciso saber o que voce vende. Me conta sua oferta principal? (nome, descricao curta, preco)"';
    }
    return `Erro ao resolver defaults: ${defaultsRes.error_kind}.`;
  }
  let defaults = defaultsRes.defaults;
  let audience_geo_summary: string | undefined;

  // 4.1) Resolve cidade/regiao Meta quando negocio local ou hint explicito (Targeting Search API)
  const { data: briefingAudienceRow } = await supabase
    .from('company_briefings')
    .select('audience')
    .eq('company_id', companyId)
    .maybeSingle();

  const metaResolve = await resolveMetaContextByCompanyId(supabase, companyId);
  if (metaResolve.ok) {
    const enriched = await enrichAudienceWithLocalGeo({
      audience: defaults.audience,
      archetype,
      briefingAudience: (briefingAudienceRow?.audience as BriefingAudienceShape | null | undefined) ?? undefined,
      metaToken: metaResolve.value.metaToken,
      conversationCityHint: input.local_geo_hint ?? null,
    });
    defaults = { ...defaults, audience: enriched.audience };
    audience_geo_summary = enriched.geoSummary;
  }

  // 5) Coleta ultimas mensagens da conversa pra passar como contexto pro generateCopy
  // (resolve bug: briefing pode ser de outro negocio mas user conversou sobre oferta diferente)
  let conversationContext: string | undefined;
  if (conversationId) {
    const { data: recentMsgs } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(8);
    if (recentMsgs && recentMsgs.length > 0) {
      conversationContext = (recentMsgs as Array<{ role: string; content: string }>)
        .reverse()
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${(m.content ?? '').slice(0, 400)}`)
        .join('\n');
    }
  }

  // 6) Gerar copy (com overrides + conversation context)
  const copy = await generateCopy({
    defaults,
    overrides: input.copy_overrides as { headline?: string; body?: string; cta?: MetaCtaEnum; description?: string } | undefined,
    archetype,
    conversation_context: conversationContext,
  });

  // 6) Signed URL fresh do criativo (bucket privado generated-creatives)
  const signedUrl = await getSignedCreativeUrl(supabase, creative.storage_path);
  if (!signedUrl) {
    return 'Erro ao gerar URL da imagem. Diga ao usuario LITERALMENTE: "Tive um problema pra acessar sua imagem agora. Posso tentar de novo?"';
  }

  // 7) Compliance preview (fail-open)
  let compliancePreview: ComplianceCheckResult;
  try {
    compliancePreview = await runComplianceCheck(supabase, {
      company_id: companyId,
      copy: { headline: copy.headline, body: copy.body, description: copy.description },
      image_url: signedUrl,
      context: 'preview',
    });
  } catch (err) {
    console.error('[propose_campaign] compliance preview threw:', err);
    compliancePreview = { severity: 'unknown', score: 0, hits: [], blocking: false, duration_ms: 0 };
  }

  // 8) Montar payload e persistir
  const payload: CampaignProposalPayload = {
    objective: defaults.objective,
    campaign_name: defaults.campaign_name,
    daily_budget_brl: defaults.daily_budget_brl,
    audience: defaults.audience,
    ...(audience_geo_summary ? { audience_geo_summary } : {}),
    optimization_goal: defaults.optimization_goal,
    copy,
    link_url: defaults.link_url,
    prereq: {
      ad_account: ctx.ad_account,
      page: ctx.page,
      pixel: ctx.pixel,
    },
    creative: {
      id: creative.id,
      format: creative.format as 'feed_1x1' | 'story_9x16' | 'reels_4x5',
      media_url_at_propose: signedUrl,
    },
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('campaign_proposals')
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      created_by_message_id: userMessageId,
      creative_id: creative.id,
      payload_jsonb: payload,
      compliance_jsonb: compliancePreview,
      status: 'pending_approval',
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('[propose_campaign] insert failed:', insertErr);
    return `Erro ao persistir proposta: ${insertErr?.message ?? 'desconhecido'}. Diga ao usuario que tive um problema interno e ele pode tentar de novo.`;
  }

  // 9) Markdown de resposta com placeholder pro frontend renderizar o card
  const proposalId = inserted.id;
  return formatProposalSummary(proposalId, payload, compliancePreview);
}

// ============================================================
// Helpers internos
// ============================================================

async function getSignedCreativeUrl(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  // TTL 15min cobre aprovacao humana lenta + retry
  const { data } = await supabase.storage
    .from('generated-creatives')
    .createSignedUrl(storagePath, 60 * 15);
  return data?.signedUrl ?? null;
}

function objectiveLeigo(obj: CampaignObjective): string {
  switch (obj) {
    case 'SALES': return 'vender mais';
    case 'LEADS': return 'gerar contatos';
    case 'AWARENESS': return 'mais gente conhecer';
    case 'TRAFFIC': return 'mais visitas no site';
    case 'ENGAGEMENT': return 'mais interacao';
  }
}

function complianceBadgeLeigo(severity: ComplianceCheckResult['severity']): string {
  switch (severity) {
    case 'none':
    case 'low': return 'Compliance OK';
    case 'medium': return 'Atencao: alguns pontos podem reduzir alcance';
    case 'high': return 'Bloqueado: precisa editar antes de publicar';
    case 'unknown': return 'Nao foi possivel verificar agora';
  }
}

function formatProposalSummary(
  proposalId: string,
  p: CampaignProposalPayload,
  c: ComplianceCheckResult,
): string {
  const geoSummary = p.audience_geo_summary?.trim();
  const geoCountries = p.audience.geo_locations.countries ?? [];
  const geoCities = p.audience.geo_locations.cities ?? [];
  let geoSuffix = '';
  if (geoSummary) geoSuffix = `, ${geoSummary}`;
  else if (geoCities.length > 0) geoSuffix = ', area local (cidade/regiao)';
  else if (geoCountries.length > 0) geoSuffix = ', Brasil';

  const lines: string[] = [];
  lines.push(`Montei sua proposta de anuncio. Da uma olhada e me diz se pode publicar.`);
  lines.push('');
  lines.push(`**${p.campaign_name}**`);
  lines.push(`- Objetivo: ${objectiveLeigo(p.objective)}`);
  lines.push(`- Investimento: R$ ${p.daily_budget_brl.toFixed(2).replace('.', ',')} por dia`);
  lines.push(`- Publico: ${p.audience.age_min}-${p.audience.age_max} anos${geoSuffix}`);
  lines.push(`- Compliance: ${complianceBadgeLeigo(c.severity)}`);
  lines.push('');
  lines.push(`<campaign-proposal id="${proposalId}"/>`);
  lines.push('');
  lines.push(`Se quiser ajustar algo antes de publicar (texto, valor, publico), e so clicar em "Editar" no card. Se estiver bom, manda "Publicar" que eu faco o resto.`);
  return lines.join('\n');
}
