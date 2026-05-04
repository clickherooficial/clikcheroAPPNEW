// ab-testing (Sprint 7/8) — handlers do chat.
// deno-lint-ignore-file no-explicit-any

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export async function startAbTest(supabase: SupabaseClient, companyId: string, args: any): Promise<string> {
  const { data, error } = await supabase
    .from('ab_tests')
    .insert({
      company_id: companyId,
      name: args.name,
      variant_a_kind: args.variant_a_kind,
      variant_a_external_id: args.variant_a_external_id,
      variant_a_label: args.variant_a_label ?? null,
      variant_b_kind: args.variant_b_kind,
      variant_b_external_id: args.variant_b_external_id,
      variant_b_label: args.variant_b_label ?? null,
      criterion: args.criterion,
      notes: args.notes ?? null,
    })
    .select('id')
    .single();

  if (error) return `Falha ao iniciar teste: ${error.message}`;
  return `A/B test "${args.name}" iniciado (test_id=${data.id}). Avalia depois com evaluate_ab_test.`;
}

export async function getAbTests(supabase: SupabaseClient, companyId: string): Promise<string> {
  const { data, error } = await supabase
    .from('ab_tests')
    .select('id, name, criterion, started_at, ended_at, winner_variant, evaluation_summary')
    .eq('company_id', companyId)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) return `Falha: ${error.message}`;
  if (!data || data.length === 0) return 'Nenhum A/B test ativo.';

  return data.map((t: any) => {
    const status = t.ended_at ? 'encerrado' : (t.winner_variant ? 'avaliado' : 'em andamento');
    const winner = t.winner_variant ? ` -> ${t.winner_variant}` : '';
    return `• ${t.name} (${t.criterion}, ${status}${winner}) — id=${t.id}`;
  }).join('\n');
}

export async function evaluateAbTest(authHeader: string, args: any): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ab-test-evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': ANON },
    body: JSON.stringify({ test_id: args.test_id }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) return `Erro ao avaliar: ${json.error ?? `HTTP ${res.status}`}`;

  const w = json.winner;
  const s = json.summary;
  if (w === 'inconclusive') {
    return `Test inconclusivo. Amostra insuficiente: A=${s.variant_a.sample}, B=${s.variant_b.sample}, min=${s.min_sample_required}.`;
  }
  if (w === 'tied') {
    return `Empate tecnico (${s.criterion}): A=${s.variant_a.rate.toFixed(4)}, B=${s.variant_b.rate.toFixed(4)}. Diff < 10%.`;
  }
  return `Vencedor: Variant ${w.toUpperCase()} no criterio ${s.criterion}. Rate A=${s.variant_a.rate.toFixed(4)}, B=${s.variant_b.rate.toFixed(4)}.`;
}
