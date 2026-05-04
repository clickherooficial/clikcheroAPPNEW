import { describe, it, expect } from 'vitest';
import { hashRow, normalizeForMeta, sha256Hex } from '@/lib/sha256';

describe('normalizeForMeta', () => {
  it('lowercases and trims emails', () => {
    expect(normalizeForMeta('  John.DOE@Example.COM  ', 'EMAIL')).toBe('john.doe@example.com');
  });

  it('strips non-digits from phones', () => {
    expect(normalizeForMeta('+55 (11) 9876-5432', 'PHONE')).toBe('551198765432');
  });

  it('lowercases first/last names and removes accents and non-letters', () => {
    expect(normalizeForMeta('João da Silva', 'FN')).toBe('joaodasilva');
    expect(normalizeForMeta("O'Connor", 'LN')).toBe('oconnor');
  });

  it('coerces gender to f|m or empty', () => {
    expect(normalizeForMeta('Female', 'GEN')).toBe('f');
    expect(normalizeForMeta('male', 'GEN')).toBe('m');
    expect(normalizeForMeta('other', 'GEN')).toBe('');
  });

  it('extracts year of birth digits and clamps to 4', () => {
    expect(normalizeForMeta('1985-03-12', 'DOBY')).toBe('1985');
  });

  it('lowercases and clips country to 2', () => {
    expect(normalizeForMeta('BRA', 'COUNTRY')).toBe('br');
  });
});

describe('sha256Hex', () => {
  it('returns 64-char hex of known fixture', async () => {
    // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const h = await sha256Hex('hello');
    expect(h).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('returns empty for empty input', async () => {
    expect(await sha256Hex('')).toBe('');
  });
});

describe('hashRow', () => {
  it('hashes each field after normalization', async () => {
    const out = await hashRow(['EMAIL', 'PHONE'], ['John@Example.com', '+55 11 98765-4321']);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(out[1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects mismatched cardinality', async () => {
    await expect(hashRow(['EMAIL'], ['a', 'b'])).rejects.toThrow(/row_length_mismatch/);
  });

  it('produces stable hash for equivalent normalized inputs', async () => {
    const a = await hashRow(['EMAIL'], ['John@Example.com']);
    const b = await hashRow(['EMAIL'], ['  john@example.COM  ']);
    expect(a[0]).toBe(b[0]);
  });
});
