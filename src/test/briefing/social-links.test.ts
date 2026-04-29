import { describe, expect, it } from 'vitest';
import { normalizeInstagramUrl, normalizeTikTokUrl } from '@/lib/social-links';

describe('normalizeInstagramUrl', () => {
  it('converte @handle', () => {
    expect(normalizeInstagramUrl('@jeanvdentz')).toBe('https://www.instagram.com/jeanvdentz/');
  });

  it('aceita apenas o usuario sem @', () => {
    expect(normalizeInstagramUrl('minhaloja')).toBe('https://www.instagram.com/minhaloja/');
  });

  it('normaliza URL com query strings', () => {
    expect(normalizeInstagramUrl('https://instagram.com/usuario?utm_source=x')).toBe(
      'https://www.instagram.com/usuario/',
    );
  });

  it('rejeita host que nao e Instagram', () => {
    expect(normalizeInstagramUrl('https://example.com/foo')).toBeUndefined();
  });
});

describe('normalizeTikTokUrl', () => {
  it('aceita @handle', () => {
    expect(normalizeTikTokUrl('@usuario')).toBe('https://www.tiktok.com/@usuario');
  });
});
