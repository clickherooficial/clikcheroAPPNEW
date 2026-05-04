// audience-management (Sprint 3/8) — hash SHA256 client-side via WebCrypto.
// PII (email/telefone) e hashada AQUI antes de subir pra Edge Fn.
// Server NUNCA recebe texto claro.

import type { AudienceCustomerSchema } from '@/types/audiences';

/**
 * Normaliza valor conforme regras Meta:
 * - EMAIL: lowercase + trim
 * - PHONE: so digitos, com country code (E.164 sem o '+')
 * - FN/LN: lowercase + trim, remover acentos/diacritics, manter so [a-z]
 * - GEN: f|m
 * - DOBY: 4 digitos
 * - COUNTRY: ISO-2 lowercase
 */
export function normalizeForMeta(value: string, kind: AudienceCustomerSchema): string {
  const v = (value ?? '').trim();
  switch (kind) {
    case 'EMAIL':
      return v.toLowerCase();
    case 'PHONE':
      return v.replace(/\D/g, '');
    case 'FN':
    case 'LN':
      return v.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z]/g, '');
    case 'GEN': {
      const c = v.toLowerCase().charAt(0);
      return c === 'f' || c === 'm' ? c : '';
    }
    case 'DOBY':
      return v.replace(/\D/g, '').slice(0, 4);
    case 'COUNTRY':
      return v.toLowerCase().slice(0, 2);
    default:
      return v;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  if (input === '') return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashRow(
  schema: AudienceCustomerSchema[],
  rawRow: string[],
): Promise<string[]> {
  if (rawRow.length !== schema.length) {
    throw new Error(`row_length_mismatch: row has ${rawRow.length} fields, schema has ${schema.length}`);
  }
  return Promise.all(rawRow.map((v, i) => sha256Hex(normalizeForMeta(v, schema[i]))));
}

export async function hashRows(
  schema: AudienceCustomerSchema[],
  rawRows: string[][],
): Promise<string[][]> {
  return Promise.all(rawRows.map((row) => hashRow(schema, row)));
}
