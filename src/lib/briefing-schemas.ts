// Schemas Zod compartilhados pelos passos do wizard e BriefingView.
// Spec: .kiro/specs/briefing-onboarding/ (task 5.1)

import { z } from 'zod';

import { normalizeInstagramUrl, normalizeTikTokUrl } from '@/lib/social-links';

// ====== Helpers ======
const trimmedNonEmpty = (max: number) =>
  z.string().trim().min(1).max(max);

const optionalUrl = z
  .string()
  .trim()
  .url()
  .or(z.literal(''))
  .optional()
  .transform((v) => (v === '' ? undefined : v));

const optionalFlexibleSocial = (normalizeFn: (s: string) => string | undefined) =>
  z.preprocess((val: unknown): unknown => {
    if (val === undefined || val === null) return undefined;
    if (typeof val !== 'string') return val;
    const t = val.trim();
    if (!t) return undefined;
    const n = normalizeFn(t);
    return n !== undefined ? n : t;
  }, z.union([z.string().url(), z.undefined()]));

const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3,8}$/, 'Cor invalida (use hex como #RRGGBB)');

// ====== Passo 1 — Negocio (R2.1) ======
export const businessStepSchema = z.object({
  niche: trimmedNonEmpty(120),
  niche_category: z.string().trim().max(60).optional(),
  short_description: trimmedNonEmpty(280),
  website_url: optionalUrl,
  social_links: z
    .object({
      instagram: optionalFlexibleSocial(normalizeInstagramUrl),
      facebook: optionalUrl,
      tiktok: optionalFlexibleSocial(normalizeTikTokUrl),
    })
    .partial()
    .default({}),
});

export type BusinessStepInput = z.infer<typeof businessStepSchema>;

// ====== Passo 2 — Oferta (R2.2 - R2.6) ======
export const offerSchema = z.object({
  id: z.string().uuid().optional(),
  is_primary: z.boolean().default(false),
  name: trimmedNonEmpty(120),
  short_description: trimmedNonEmpty(280),
  price: z.number().nonnegative(),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  format: z.enum(['course', 'service', 'physical', 'saas', 'other']),
  sales_url: optionalUrl,
  pains_resolved: z.array(z.string().trim().min(1).max(160)).max(5).default([]),
  benefits: z.array(z.string().trim().min(1).max(160)).max(5).default([]),
  social_proof: z
    .object({
      testimonials: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
      impactNumbers: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
      partnerLogos: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
    })
    .partial()
    .default({}),
  position: z.number().int().nonnegative().default(0),
});

export type OfferInput = z.infer<typeof offerSchema>;

export const offerStepSchema = z.object({
  primary: offerSchema.extend({ is_primary: z.literal(true) }),
  secondary: z.array(offerSchema.extend({ is_primary: z.literal(false) })).max(10),
});

// ====== Passo 3 — Audiencia (R3.1, R3.2, R3.5) ======
export const audienceSchema = z
  .object({
    ageRange: z
      .object({
        min: z.number().int().min(13).max(120),
        max: z.number().int().min(13).max(120),
      })
      .refine((v) => v.max >= v.min, { message: 'idade max deve ser >= min' }),
    gender: z.enum(['male', 'female', 'mixed']).optional(),
    location: z.object({
      country: trimmedNonEmpty(60),
      state: z.string().trim().max(60).optional(),
      city: z.string().trim().max(80).optional(),
    }),
    occupation: z.string().trim().max(120).optional(),
    incomeRange: z.enum(['low', 'mid', 'high', 'premium']).optional(),
    awarenessLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    interests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    behaviors: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    languageSamples: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  })
  .partial({ ageRange: true, location: true });

export type AudienceInput = z.infer<typeof audienceSchema>;

export const audienceStepSchema = z.object({
  audience: audienceSchema,
});

// ====== Passo 4 — Tom de voz (R3.3, R3.4, R3.6) ======
export const toneSchema = z.object({
  formality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  technicality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  emotional: z
    .array(
      z.enum(['aspirational', 'urgent', 'welcoming', 'authoritative', 'fun', 'rational']),
    )
    .max(3)
    .default([]),
  preferredCtas: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  forbiddenPhrases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});

export type ToneInput = z.infer<typeof toneSchema>;

export const toneStepSchema = z.object({ tone: toneSchema });

// ====== Passo 5 — Identidade Visual (R4.2) ======
// (uploads de logo/mood-board sao tratados separadamente via useBriefingAssets;
//  aqui validamos apenas a paleta de cores hex.)
export const paletteSchema = z
  .object({
    primary: hexColor.optional(),
    secondary: hexColor.optional(),
    accent: hexColor.optional(),
    background: hexColor.optional(),
  })
  .partial();

export type PaletteInput = z.infer<typeof paletteSchema>;

export const visualStepSchema = z.object({ palette: paletteSchema });

// ====== Passo 6 — Proibicoes (R5.1 - R5.3) ======
export const prohibitionItemSchema = z.object({
  category: z.enum(['word', 'topic', 'visual']),
  value: z.string().trim().min(1).max(200),
});

export const prohibitionsStepSchema = z.object({
  prohibitions: z.array(prohibitionItemSchema).max(50).default([]),
});

export type ProhibitionItemInput = z.infer<typeof prohibitionItemSchema>;

// ====== Helper: schema do passo por numero ======
export const STEP_SCHEMAS = {
  1: businessStepSchema,
  2: offerStepSchema,
  3: audienceStepSchema,
  4: toneStepSchema,
  5: visualStepSchema,
  6: prohibitionsStepSchema,
} as const;

export type WizardStepNumber = keyof typeof STEP_SCHEMAS;
