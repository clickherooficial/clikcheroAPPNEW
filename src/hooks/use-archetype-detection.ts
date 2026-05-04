// Hook fire-and-forget para acionar o edge fn `archetype-detector`.
// Spec: .kiro/specs/business-archetype-personas/ (task 8.1)
// Comportamento: silencioso por design (R2.6) — falhas só vão ao console.
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ckxewdahdiambbxmqxgb.supabase.co';

export function useArchetypeDetection() {
  const trigger = async (companyId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // silent
      const url = `${SUPABASE_URL}/functions/v1/archetype-detector`;
      // Fire-and-forget — não aguardamos retorno relevante; mas usamos await pra capturar erros silenciosos no console
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!res.ok) {
        console.warn('[useArchetypeDetection] non-ok response', res.status);
      }
    } catch (err) {
      console.warn('[useArchetypeDetection] failed silently', err);
    }
  };
  return { trigger };
}
