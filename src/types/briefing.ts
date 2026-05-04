// Tipos do dominio briefing-onboarding.
// Spec: .kiro/specs/briefing-onboarding/

import type { Archetype } from '@/types/business-archetype';

export type BriefingStatus = 'not_started' | 'incomplete' | 'complete';
export type ToneScale = 1 | 2 | 3 | 4 | 5;
export type EmotionalTone =
  | 'aspirational'
  | 'urgent'
  | 'welcoming'
  | 'authoritative'
  | 'fun'
  | 'rational';
export type Currency = 'BRL' | 'USD' | 'EUR';
export type OfferFormat = 'course' | 'service' | 'physical' | 'saas' | 'other';
export type AssetKind = 'logo_primary' | 'logo_alt' | 'mood_board';
export type AssetMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
export type ProhibitionCategory = 'word' | 'topic' | 'visual';
export type ProhibitionSource = 'user' | 'vertical_default';

export interface AudienceData {
  ageRange?: { min: number; max: number };
  gender?: 'male' | 'female' | 'mixed';
  location?: { country: string; state?: string; city?: string };
  occupation?: string;
  incomeRange?: 'low' | 'mid' | 'high' | 'premium';
  awarenessLevel?: 1 | 2 | 3 | 4 | 5;
  interests?: string[];
  behaviors?: string[];
  languageSamples?: string[];
}

export interface ToneData {
  formality?: ToneScale;
  technicality?: ToneScale;
  emotional?: EmotionalTone[];
  preferredCtas?: string[];
  forbiddenPhrases?: string[];
}

export interface PaletteData {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface CompanyBriefing {
  company_id: string;
  niche: string | null;
  niche_category: string | null;
  short_description: string | null;
  website_url: string | null;
  social_links: SocialLinks;
  audience: AudienceData;
  tone: ToneData;
  palette: PaletteData;
  status: BriefingStatus;
  business_archetype: Archetype | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyOffer {
  id: string;
  company_id: string;
  is_primary: boolean;
  name: string;
  short_description: string;
  price: number;
  currency: Currency;
  format: OfferFormat;
  sales_url: string | null;
  pains_resolved: string[];
  benefits: string[];
  social_proof: { testimonials?: string[]; impactNumbers?: string[]; partnerLogos?: string[] };
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BrandingAsset {
  id: string;
  company_id: string;
  kind: AssetKind;
  storage_path: string;
  mime_type: AssetMime;
  size_bytes: number;
  width: number | null;
  height: number | null;
  signed_url?: string;
  created_at: string;
}

export interface CompanyProhibition {
  id: string;
  company_id: string;
  category: ProhibitionCategory;
  value: string;
  source: ProhibitionSource;
  created_at: string;
}

export type BriefingMissingField =
  | 'niche'
  | 'short_description'
  | 'primary_offer'
  | 'audience_age'
  | 'audience_location'
  | 'tone_formality'
  | 'tone_technicality'
  | 'tone_emotional'
  | 'visual_identity';

export interface BriefingStatusRow {
  company_id: string;
  is_complete: boolean;
  score: number;
  missing_fields: BriefingMissingField[];
}

// Erros estruturados para hooks (Result-style)
export type BriefingError =
  | { kind: 'unauthorized' }
  | { kind: 'validation'; fields: string[] }
  | { kind: 'conflict'; reason: 'must_keep_one_primary_offer' }
  | { kind: 'network'; message: string };

export type AssetError =
  | { kind: 'too_large'; maxBytes: number }
  | { kind: 'unsupported_mime' }
  | { kind: 'mood_board_limit_reached'; max: number }
  | { kind: 'unauthorized' }
  | { kind: 'network'; message: string };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Constantes de validacao alinhadas com o backend.
export const BRIEFING_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const BRIEFING_ASSET_ALLOWED_MIMES: AssetMime[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
export const MOOD_BOARD_MAX_ITEMS = 10;
export const SECONDARY_OFFERS_MAX = 10;
export const SIGNED_URL_TTL_SECONDS = 3600; // 1h conforme R4.6
