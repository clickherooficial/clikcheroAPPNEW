// audience-management (Sprint 3/8) — tipos compartilhados frontend.

export type AudienceSubtype = 'CUSTOM' | 'LOOKALIKE' | 'WEBSITE' | 'APP' | 'ENGAGEMENT';

export type AudienceCustomerSchema = 'EMAIL' | 'PHONE' | 'FN' | 'LN' | 'GEN' | 'DOBY' | 'COUNTRY';

export type LookalikeRatio = 0.01 | 0.02 | 0.05 | 0.10;

export interface MetaAudience {
  id: string;
  company_id: string;
  external_id: string;
  name: string;
  description: string | null;
  subtype: AudienceSubtype;
  parent_audience_id: string | null;
  approximate_count_lower_bound: number | null;
  approximate_count_upper_bound: number | null;
  delivery_status: { code?: number; description?: string } | null;
  operation_status: { code?: number; description?: string } | null;
  retention_days: number | null;
  lookalike_spec: { country: string; ratio: number; type: string } | null;
  rule: Record<string, unknown> | null;
  time_created: string | null;
  time_updated: string | null;
  local_created_at: string;
  local_updated_at: string | null;
}

export interface CreateCustomerListAudiencePayload {
  name: string;
  description?: string;
  customer_file_source?: 'USER_PROVIDED_ONLY' | 'PARTNER_PROVIDED_ONLY' | 'BOTH_USER_AND_PARTNER_PROVIDED';
  payload: { schema: AudienceCustomerSchema[]; data: string[][] };
  retention_days?: number;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface CreateLookalikePayload {
  name: string;
  origin_audience_id?: string;
  origin_audience_external_id?: string;
  lookalike_spec: {
    country: string;
    ratio: LookalikeRatio;
    type?: 'similarity' | 'reach' | 'reach_and_similarity';
  };
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface UpdateAudiencePayload {
  audience_id?: string;
  audience_external_id?: string;
  name?: string;
  description?: string;
  retention_days?: number;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface DeleteAudiencePayload {
  audience_id: string;
  confirm?: boolean;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface AudienceUsageRow {
  audience_id: string;
  audience_external_id: string;
  audience_name: string;
  subtype: AudienceSubtype;
  adset_id: string;
  adset_external_id: string;
  adset_name: string;
  adset_status: string;
  usage_kind: 'included' | 'excluded' | null;
}

export class AudienceError extends Error {
  reason: string;
  payload: unknown;
  blocked: boolean;
  inActiveUse?: boolean;
  ledgerId?: string;
  constructor(reason: string, payload: unknown, opts: { blocked?: boolean; inActiveUse?: boolean; ledgerId?: string } = {}) {
    super(reason);
    this.name = 'AudienceError';
    this.reason = reason;
    this.payload = payload;
    this.blocked = opts.blocked ?? false;
    this.inActiveUse = opts.inActiveUse;
    this.ledgerId = opts.ledgerId;
  }
}
