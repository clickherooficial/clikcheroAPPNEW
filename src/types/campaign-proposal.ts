// Tipos do dominio campaign-publish-flow.
// Spec: .kiro/specs/chat-publish-flow/ (task 1.3)
//
// Modelos espelham:
// - Tabela `campaign_proposals` (migration 20260501000001_campaign_proposals.sql)
// - Schema Zod do edge `campaign-publish` (Campaign + Adset + Ad)
//
// Sao consumidos pelo hook `useCampaignProposal`, pelo card
// `InlineCampaignProposalCard`, e pelo handler `propose_campaign` no
// orchestrator (via re-exports na pasta _shared).

export type CampaignProposalStatus =
  | 'pending_approval'
  | 'cancelled'
  | 'publishing'
  | 'live'
  | 'failed'
  | 'expired';

// Subset dos objetivos Meta usados pelo agente (sem APP_PROMOTION).
// O edge campaign-publish aceita o codigo OUTCOME_<X>; aqui usamos a
// forma curta pra UI/LLM e o mapper traduz.
export type CampaignObjective =
  | 'SALES'
  | 'LEADS'
  | 'AWARENESS'
  | 'TRAFFIC'
  | 'ENGAGEMENT';

export type MetaCtaEnum =
  | 'LEARN_MORE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'SUBSCRIBE'
  | 'DOWNLOAD'
  | 'CONTACT_US'
  | 'GET_OFFER'
  | 'BOOK_NOW';

export type MetaOptimizationGoal =
  | 'LINK_CLICKS'
  | 'LANDING_PAGE_VIEWS'
  | 'OFFSITE_CONVERSIONS'
  | 'REACH'
  | 'IMPRESSIONS'
  | 'LEAD_GENERATION';

// ============================================================
// Sub-schemas do payload
// ============================================================

export interface AudiencePayload {
  age_min: number;       // 13-65
  age_max: number;       // 13-65
  geo_locations: {
    countries?: string[];
    cities?: Array<{ key: string; radius?: number; distance_unit?: 'kilometer' | 'mile' }>;
  };
  // v1 desta spec: interests[] sempre vazio (Targeting Search API fica pra Fase 2).
  interests?: Array<{ id: string; name: string }>;
  // v1: genders ausente = todos
  genders?: Array<1 | 2>;
}

export interface CopyPayload {
  headline: string;       // <=40
  body: string;           // <=125
  description?: string;   // <=27
  cta: MetaCtaEnum;
}

export interface PrereqSnapshot {
  ad_account: { id: string; account_id: string; name: string | null };
  page: { id: string; page_id: string; name: string | null };
  pixel?: { id: string; pixel_id: string };
}

export interface CreativeSnapshot {
  id: string;
  format: 'feed_1x1' | 'story_9x16' | 'reels_4x5';
  // URL signed da imagem no momento da proposta (pode expirar; mapper regenera).
  media_url_at_propose: string;
}

// ============================================================
// Payload completo persistido em campaign_proposals.payload_jsonb
// ============================================================

export interface CampaignProposalPayload {
  // Campaign level
  objective: CampaignObjective;
  campaign_name: string;
  // Adset level
  daily_budget_brl: number;       // >=10
  start_time?: string;            // ISO 8601
  stop_time?: string;             // ISO 8601
  audience: AudiencePayload;
  optimization_goal: MetaOptimizationGoal;
  /** Rotulo quando targeting resolve cidade/regiao (só UX; opcional em JSON legacy) */
  audience_geo_summary?: string;
  // Ad level
  copy: CopyPayload;
  link_url: string;
  // Snapshots (auditoria + uso pelo mapper)
  prereq: PrereqSnapshot;
  creative: CreativeSnapshot;
}

// ============================================================
// Compliance preview embutido (compliance_jsonb)
// ============================================================

export type ComplianceSeverity = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export interface ComplianceHit {
  kind: 'word' | 'visual' | 'topic';
  text: string;
  severity: ComplianceSeverity;
}

export interface CompliancePreview {
  severity: ComplianceSeverity;
  score: number;
  hits: ComplianceHit[];
  blocking: boolean;
  duration_ms: number;
}

// ============================================================
// Erro estruturado (campos error_payload)
// ============================================================

export type CampaignProposalErrorKind =
  | 'validation'
  | 'compliance'
  | 'upstream'
  | 'timeout'
  | 'unknown';

export interface CampaignProposalErrorPayload {
  error_kind: CampaignProposalErrorKind;
  message: string;          // mensagem legivel pro usuario
  raw?: unknown;            // payload bruto da edge fn (pra debug)
  failed_at_step?: string;  // 'compliance' | 'campaign_create' | 'adset_create' | 'creative_create' | 'ad_create'
}

// ============================================================
// Linha do banco
// ============================================================

export interface CampaignProposal {
  id: string;
  company_id: string;
  conversation_id: string;
  created_by_message_id: string | null;
  creative_id: string;
  payload_jsonb: CampaignProposalPayload;
  compliance_jsonb: CompliancePreview | Record<string, never>;
  status: CampaignProposalStatus;
  publication_id: string | null;
  error_payload: CampaignProposalErrorPayload | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// ============================================================
// Erros de pre-requisito (gate antes de criar a proposta)
// ============================================================

export type PrereqErrorKind =
  | 'missing_meta_connection'
  | 'missing_page_selection'
  | 'creative_not_found'
  | 'creative_not_in_tenant'
  | 'briefing_no_offer';
