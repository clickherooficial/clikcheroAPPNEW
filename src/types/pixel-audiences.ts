// pixel-engagement-audiences (Sprint 4/8) — tipos.

export type PixelEvent =
  | 'PageView' | 'AddToCart' | 'Purchase' | 'Lead' | 'CompleteRegistration'
  | 'ViewContent' | 'AddPaymentInfo' | 'InitiateCheckout' | 'Search' | 'Subscribe';

export type EngagementSourceKind = 'page' | 'ig_business' | 'video' | 'lead_form' | 'event';

export type EngagementTemplate =
  | 'page_engaged_users' | 'page_visitors'
  | 'video_viewers_25_pct' | 'video_viewers_50_pct' | 'video_viewers_75_pct' | 'video_viewers_95_pct'
  | 'video_viewers_3_seconds' | 'video_viewers_10_seconds'
  | 'lead_form_opened' | 'lead_form_submitted'
  | 'event_responded' | 'event_attended';

export interface CreatePixelAudiencePayload {
  name: string;
  pixel_id: string;
  event: PixelEvent;
  url_contains?: string;
  retention_days?: number;
  exclude_event?: PixelEvent;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface CreateEngagementAudiencePayload {
  name: string;
  source_kind: EngagementSourceKind;
  source_id: string;
  template: EngagementTemplate;
  retention_days?: number;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

export interface AudienceSourceCacheRow {
  id: string;
  company_id: string;
  kind: 'pixel' | 'page' | 'ig_business' | 'video' | 'lead_form';
  external_id: string;
  name: string;
  metadata: Record<string, unknown> | null;
  fetched_at: string;
}
