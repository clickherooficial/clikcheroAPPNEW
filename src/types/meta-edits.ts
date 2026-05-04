// meta-edits-suite (Sprint 2/8) - tipos compartilhados frontend
// Mantem 1:1 com Zod schemas das Edge Fns; mudancas em uma das pontas exigem atualizar a outra.

export type BidStrategy =
  | 'LOWEST_COST_WITHOUT_CAP'
  | 'LOWEST_COST_WITH_BID_CAP'
  | 'COST_CAP';

export type AdsetOptimizationGoal =
  | 'LINK_CLICKS'
  | 'OFFSITE_CONVERSIONS'
  | 'LANDING_PAGE_VIEWS'
  | 'POST_ENGAGEMENT'
  | 'REACH'
  | 'IMPRESSIONS';

export type CampaignStatus = 'ACTIVE' | 'PAUSED';

export type TriggeredBy = 'user' | 'agent' | 'rule' | 'plan';

export interface UpdateCampaignPayload {
  campaign_id?: string;
  campaign_external_id?: string;
  name?: string;
  status?: CampaignStatus;
  daily_budget?: number;       // BRL no client; convertido pra centavos na Edge Fn
  lifetime_budget?: number;
  bid_strategy?: BidStrategy;
  bid_amount?: number;
  start_time?: string;          // ISO
  stop_time?: string;
  force?: boolean;
  triggered_by?: TriggeredBy;
}

export interface UpdateAdsetPayload {
  adset_id?: string;
  adset_external_id?: string;
  name?: string;
  status?: CampaignStatus;
  daily_budget?: number;
  lifetime_budget?: number;
  optimization_goal?: AdsetOptimizationGoal;
  bid_amount?: number;
  targeting_patch?: Record<string, unknown>; // merge sobre targeting atual
  start_time?: string;
  end_time?: string;
  force?: boolean;
  triggered_by?: TriggeredBy;
}

export interface UpdateAdPayload {
  ad_id?: string;                  // local id se o sistema souber; caso contrario ad_external_id
  ad_external_id?: string;
  name?: string;
  status?: CampaignStatus;
  creative_id?: string;            // creative externo do Meta (id)
  force?: boolean;
  triggered_by?: TriggeredBy;
}

export interface ShiftBudgetPayload {
  from_entity_kind: 'campaign' | 'adset';
  from_entity_id?: string;         // local uuid
  from_external_id?: string;       // ou external direto
  to_entity_kind: 'campaign' | 'adset';
  to_entity_id?: string;
  to_external_id?: string;
  amount_brl: number;              // valor a transferir (positivo)
  force?: boolean;
  triggered_by?: TriggeredBy;
}

export interface ChangeSchedulePayload {
  entity_kind: 'campaign' | 'adset';
  entity_id?: string;
  external_id?: string;
  start_time?: string;
  stop_time?: string;
  end_time?: string;
  // dayparting: array de pares [start_minute_of_week, end_minute_of_week]
  // Ex: segunda 09:00 -> 18:00 = [540, 1080]
  schedule?: Array<{ start_minute: number; end_minute: number; days: number[] }>;
  force?: boolean;
  triggered_by?: TriggeredBy;
}

export interface MetaEditSuccess {
  ok: true;
  external_id: string;
  fields_updated: string[];
  ledger_id: string;
  sandbox?: boolean;
  drift_detected?: boolean;
}

export interface MetaEditBlocked {
  ok: false;
  blocked: true;
  reason: string;
  ledger_id: string;
  gate?: Record<string, unknown>;
}

export interface MetaEditFailure {
  ok: false;
  blocked?: false;
  error: string;
  ledger_id?: string;
}

export type MetaEditResponse = MetaEditSuccess | MetaEditBlocked | MetaEditFailure;

export class MetaEditError extends Error {
  reason: string;
  payload: unknown;
  blocked: boolean;
  ledgerId?: string;
  constructor(reason: string, payload: unknown, blocked = false, ledgerId?: string) {
    super(reason);
    this.name = 'MetaEditError';
    this.reason = reason;
    this.payload = payload;
    this.blocked = blocked;
    this.ledgerId = ledgerId;
  }
}

export interface BudgetImpactEstimate {
  current_daily: number | null;
  new_daily: number;
  delta_brl: number;
  delta_pct: number | null;
  projection_30d_brl: number;
}
