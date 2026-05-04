// pixel-engagement-audiences (Sprint 4/8)
// Constroi rule jsonb pra Meta customaudiences a partir de payloads tipados.
// deno-lint-ignore-file no-explicit-any

export type PixelEvent =
  | 'PageView' | 'AddToCart' | 'Purchase' | 'Lead' | 'CompleteRegistration'
  | 'ViewContent' | 'AddPaymentInfo' | 'InitiateCheckout' | 'Search' | 'Subscribe';

export interface PixelAudienceInput {
  pixel_id: string;
  event: PixelEvent;
  url_contains?: string;
  retention_days: number; // 1-180
  exclude_event?: PixelEvent;
}

export type EngagementSourceKind = 'page' | 'ig_business' | 'video' | 'lead_form' | 'event';

export type EngagementTemplate =
  | 'page_engaged_users'
  | 'page_visitors'
  | 'video_viewers_25_pct'
  | 'video_viewers_50_pct'
  | 'video_viewers_75_pct'
  | 'video_viewers_95_pct'
  | 'video_viewers_3_seconds'
  | 'video_viewers_10_seconds'
  | 'lead_form_opened'
  | 'lead_form_submitted'
  | 'event_responded'
  | 'event_attended';

export interface EngagementAudienceInput {
  source_kind: EngagementSourceKind;
  source_id: string;
  template: EngagementTemplate;
  retention_days: number; // 1-365
}

function buildPixelFilter(event: PixelEvent, url_contains?: string): any {
  const filters: any[] = [
    { field: 'event', operator: '=', value: event },
  ];
  if (url_contains) {
    filters.push({ field: 'url', operator: 'i_contains', value: url_contains });
  }
  return filters.length === 1
    ? filters[0]
    : { operator: 'and', filters };
}

export function buildPixelRule(input: PixelAudienceInput): any {
  const retention_seconds = input.retention_days * 86400;
  const inclusionRule = {
    event_sources: [{ id: input.pixel_id, type: 'pixel' }],
    retention_seconds,
    filter: buildPixelFilter(input.event, input.url_contains),
  };
  const out: any = {
    inclusions: { operator: 'or', rules: [inclusionRule] },
  };
  if (input.exclude_event && input.exclude_event !== input.event) {
    out.exclusions = {
      operator: 'or',
      rules: [{
        event_sources: [{ id: input.pixel_id, type: 'pixel' }],
        retention_seconds,
        filter: { field: 'event', operator: '=', value: input.exclude_event },
      }],
    };
  }
  return out;
}

const TEMPLATE_TO_FILTER: Record<EngagementTemplate, any> = {
  page_engaged_users: { template: 'engaged_users' },
  page_visitors: { template: 'page_visitors' },
  video_viewers_25_pct: { template: 'video_views', percent: 25 },
  video_viewers_50_pct: { template: 'video_views', percent: 50 },
  video_viewers_75_pct: { template: 'video_views', percent: 75 },
  video_viewers_95_pct: { template: 'video_views', percent: 95 },
  video_viewers_3_seconds: { template: 'video_views', seconds: 3 },
  video_viewers_10_seconds: { template: 'video_views', seconds: 10 },
  lead_form_opened: { template: 'lead_form_opened' },
  lead_form_submitted: { template: 'lead_form_submitted' },
  event_responded: { template: 'event_responded' },
  event_attended: { template: 'event_attended' },
};

const KIND_TO_SOURCE_TYPE: Record<EngagementSourceKind, string> = {
  page: 'page',
  ig_business: 'ig_business',
  video: 'video',
  lead_form: 'leadgen_form',
  event: 'event',
};

export function buildEngagementRule(input: EngagementAudienceInput): any {
  const retention_seconds = input.retention_days * 86400;
  const filterPart = TEMPLATE_TO_FILTER[input.template];
  return {
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ id: input.source_id, type: KIND_TO_SOURCE_TYPE[input.source_kind] }],
        retention_seconds,
        ...filterPart,
      }],
    },
  };
}

export function pixelAudienceSubtype(): string {
  return 'WEBSITE';
}

export function engagementAudienceSubtype(): string {
  return 'ENGAGEMENT';
}
