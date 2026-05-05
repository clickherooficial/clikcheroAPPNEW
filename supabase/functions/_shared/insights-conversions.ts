/**
 * Extrai métricas de "conversão" unificadas a partir do array `actions`
 * devolvido pelo Insights API ( nível ad / campaign ).
 *
 * Legado só lia messaging_conversation_started_* — campanhas OUTCOME_LEADS
 * com conversão em site / formulário Instant usam outros `action_type` (ex.: `lead`).
 */

export type InsightActionRow = { action_type: string; value: string };

function num(actions: InsightActionRow[] | undefined, type: string): number {
  const v = actions?.find((a) => a.action_type === type)?.value;
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Máximo entre tipos paralelos para evitar contar Pixel + mesmo lead duas vezes em alguns setups. */
function maxAmong(actions: InsightActionRow[] | undefined, types: readonly string[]): number {
  let m = 0;
  for (const t of types) m = Math.max(m, num(actions, t));
  return m;
}

/** WhatsApp / Messenger — conversas iniciadas */
export const MESSAGING_CONV_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
] as const;

/** Leads: Lead Ads site, formulário Instant, Pixel "Lead", registros genéricos */
export const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_generated',
  'onsite_conversion.lead',
  'offsite_conversion.fb_pixel_lead',
  'offsite_conversion.lead',
  'completed_registration',
  'contact_total',
  'contact',
  'onsite_conversion.contact_total',
  'schedule_total',
] as const;

/** Contagem mostrada em `conversas_iniciadas` / CPL no painel */
export function extractConversasIniciadas(actions: InsightActionRow[] | undefined): number {
  const messaging = maxAmong(actions, MESSAGING_CONV_ACTION_TYPES);
  const leads = maxAmong(actions, LEAD_ACTION_TYPES);
  /** Dois objetivos distintos raramente têm ambos na mesma linha; usar max evita gap */
  return Math.max(messaging, leads);
}

export function extractCustoConversa(
  actions: InsightActionRow[] | undefined,
  costs: InsightActionRow[] | undefined,
): number | null {
  const messaging = maxAmong(actions, MESSAGING_CONV_ACTION_TYPES);
  const leads = maxAmong(actions, LEAD_ACTION_TYPES);

  const firstCost = (types: readonly string[]): number | null => {
    for (const t of types) {
      const c = num(costs, t);
      if (c > 0) return c;
    }
    return null;
  };

  if (leads >= messaging && leads > 0) {
    return firstCost(LEAD_ACTION_TYPES) ?? firstCost(MESSAGING_CONV_ACTION_TYPES);
  }
  if (messaging > 0) {
    return firstCost(MESSAGING_CONV_ACTION_TYPES) ?? firstCost(LEAD_ACTION_TYPES);
  }
  return firstCost(MESSAGING_CONV_ACTION_TYPES) ?? firstCost(LEAD_ACTION_TYPES);
}
