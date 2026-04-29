// Unit tests dos schemas Zod compartilhados (task 10.1).
// Spec: briefing-onboarding (R2.6, R3.6, R4.5, R8.2)

import { describe, expect, it } from 'vitest';
import {
  audienceStepSchema,
  businessStepSchema,
  offerSchema,
  paletteSchema,
  toneStepSchema,
  visualStepSchema,
} from '@/lib/briefing-schemas';

describe('businessStepSchema', () => {
  it('aceita payload minimo valido', () => {
    const r = businessStepSchema.safeParse({
      niche: 'Moda feminina',
      short_description: 'Loja online de vestidos',
      social_links: {},
    });
    expect(r.success).toBe(true);
  });

  it('rejeita niche vazio', () => {
    const r = businessStepSchema.safeParse({
      niche: '   ',
      short_description: 'algo',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita description acima do limite', () => {
    const r = businessStepSchema.safeParse({
      niche: 'X',
      short_description: 'a'.repeat(281),
    });
    expect(r.success).toBe(false);
  });

  it('aceita social_links vazio (opcional)', () => {
    const r = businessStepSchema.safeParse({
      niche: 'X',
      short_description: 'Y',
    });
    expect(r.success).toBe(true);
  });

  it('normaliza Instagram @handle ou usuario para URL', () => {
    const r = businessStepSchema.safeParse({
      niche: 'Moda',
      short_description: 'Loja online',
      social_links: { instagram: '@perfildaloja' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.social_links?.instagram).toBe('https://www.instagram.com/perfildaloja/');
    }
  });
});

describe('offerSchema', () => {
  const VALID_BASE = {
    name: 'Curso Avancado',
    short_description: 'Para quem ja sabe o basico',
    price: 199.9,
    format: 'course' as const,
  };

  it('aceita oferta valida com primary=true', () => {
    const r = offerSchema.safeParse({ ...VALID_BASE, is_primary: true });
    expect(r.success).toBe(true);
  });

  it('rejeita preco negativo', () => {
    const r = offerSchema.safeParse({ ...VALID_BASE, price: -5 });
    expect(r.success).toBe(false);
  });

  it('rejeita name vazio (R2.6)', () => {
    const r = offerSchema.safeParse({ ...VALID_BASE, name: '' });
    expect(r.success).toBe(false);
  });

  it('rejeita short_description vazia (R2.6)', () => {
    const r = offerSchema.safeParse({ ...VALID_BASE, short_description: '' });
    expect(r.success).toBe(false);
  });

  it('rejeita format invalido', () => {
    const r = offerSchema.safeParse({ ...VALID_BASE, format: 'magic' });
    expect(r.success).toBe(false);
  });

  it('aplica defaults para currency, position e arrays', () => {
    const r = offerSchema.parse(VALID_BASE);
    expect(r.currency).toBe('BRL');
    expect(r.position).toBe(0);
    expect(r.pains_resolved).toEqual([]);
    expect(r.benefits).toEqual([]);
  });
});

describe('audienceStepSchema', () => {
  it('aceita audience completo', () => {
    const r = audienceStepSchema.safeParse({
      audience: {
        ageRange: { min: 18, max: 45 },
        location: { country: 'Brasil' },
        gender: 'mixed',
        interests: [],
        behaviors: [],
        languageSamples: [],
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejeita ageRange com max < min', () => {
    const r = audienceStepSchema.safeParse({
      audience: {
        ageRange: { min: 50, max: 30 },
        location: { country: 'Brasil' },
      },
    });
    expect(r.success).toBe(false);
  });

  it('aceita audience parcial (todos campos opcionais)', () => {
    const r = audienceStepSchema.safeParse({ audience: {} });
    expect(r.success).toBe(true);
  });
});

describe('toneStepSchema', () => {
  it('aplica defaults R3.6 (3/5 nas escalas, listas vazias)', () => {
    const r = toneStepSchema.parse({ tone: {} });
    expect(r.tone.formality).toBe(3);
    expect(r.tone.technicality).toBe(3);
    expect(r.tone.emotional).toEqual([]);
  });

  it('limita emotional a 3 itens', () => {
    const r = toneStepSchema.safeParse({
      tone: {
        formality: 4,
        technicality: 2,
        emotional: ['aspirational', 'urgent', 'welcoming', 'fun'],
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejeita formality fora de 1-5', () => {
    const r = toneStepSchema.safeParse({
      tone: { formality: 6, technicality: 3 },
    });
    expect(r.success).toBe(false);
  });
});

describe('paletteSchema / visualStepSchema (R4.5 — formato)', () => {
  it('aceita hex valido com #', () => {
    const r = paletteSchema.safeParse({ primary: '#3b82f6', background: '#000000' });
    expect(r.success).toBe(true);
  });

  it('rejeita string que nao e hex', () => {
    const r = paletteSchema.safeParse({ primary: 'azul' });
    expect(r.success).toBe(false);
  });

  it('aceita paleta vazia', () => {
    const r = visualStepSchema.safeParse({ palette: {} });
    expect(r.success).toBe(true);
  });
});
