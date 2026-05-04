// agent-plan-execute — agent-execution-loop (Sprint 5/8)
// Executa um plan APROVADO sequencialmente. Para no primeiro fail.
// Captura ledger_ids[] em cada step (habilita rollback futuro).
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireTenant } from '../_shared/tenant-guard.ts';
import { jsonResponse } from '../_shared/meta-edits-helpers.ts';

const PayloadSchema = z.object({ plan_id: z.string().uuid() });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Mapeamento action_type -> Edge Fn (APENAS novos tipos Sprint 2-4).
// Legados (pause_campaign / reactivate_campaign / update_budget / pause_ad / reactivate_ad)
// sao executados pelo `plan-action` Edge Fn EXISTENTE imediatamente apos aprovacao do plan
// — esta Edge Fn (agent-plan-execute) e usada pra plans que tem action_types NOVOS,
// que o plan-action nao sabe executar. Tipicamente: plans com mix de novos+legados acabam
// 'partial' apos plan-action, e o usuario pode clicar "Executar pendentes" pra completar.
const ACTION_FN_MAP: Record<string, string> = {
  // Sprint 2
  update_campaign: 'meta-update-campaign',
  update_adset: 'meta-update-adset',
  update_ad: 'meta-update-ad',
  shift_budget: 'meta-shift-budget',
  change_schedule: 'meta-change-schedule',
  // Sprint 3
  create_customer_list_audience: 'meta-audience-create',
  create_lookalike_audience: 'meta-audience-lookalike',
  update_audience: 'meta-audience-update',
  delete_audience: 'meta-audience-delete',
  // Sprint 4
  create_pixel_audience: 'meta-audience-create-rule',
  create_engagement_audience: 'meta-audience-create-rule',
};

const LEGACY_ACTION_TYPES = new Set([
  'pause_campaign', 'reactivate_campaign', 'pause_ad', 'reactivate_ad', 'update_budget',
]);

function adaptPayload(actionType: string, raw: any): any {
  // Sprint 4 wraps com kind discriminator
  if (actionType === 'create_pixel_audience') return { kind: 'pixel', ...raw };
  if (actionType === 'create_engagement_audience') return { kind: 'engagement', ...raw };
  return raw;
}

async function invokeFn(fnName: string, authHeader: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': ANON,
    },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => ({}));
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const tenant = await requireTenant(req, supabaseAdmin, { cors });
  if (!tenant.ok) return tenant.response;
  const { companyId } = tenant.value;

  let payload: z.infer<typeof PayloadSchema>;
  try {
    payload = PayloadSchema.parse(await req.json());
  } catch (e: any) {
    return jsonResponse({ error: 'invalid_payload', detail: e?.errors ?? e?.message }, 400, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  // Lock atomico: approved|partial → running
  // 'approved' = plan recem aprovado (plan-action talvez nao tenha rodado, ou rodou e deixou approveds pendentes)
  // 'partial' = plan-action executou alguns steps mas deixou outros pendentes (acao_type novo desconhecido)
  const { data: locked, error: lockErr } = await supabaseAdmin
    .from('plans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', payload.plan_id)
    .eq('company_id', companyId)
    .in('status', ['approved', 'partial'])
    .select('id, human_summary')
    .maybeSingle();

  if (lockErr) {
    return jsonResponse({ error: 'lock_failed', detail: lockErr.message }, 500, cors);
  }
  if (!locked) {
    return jsonResponse({ error: 'plan_not_in_runnable_state', hint: 'plan precisa estar em status approved ou partial' }, 422, cors);
  }

  // Pega steps em ordem
  const { data: steps } = await supabaseAdmin
    .from('approvals')
    .select('id, action_type, payload, plan_step_order, status')
    .eq('plan_id', payload.plan_id)
    .order('plan_step_order', { ascending: true });

  const ledgerIds: string[] = [];
  let executed = 0;
  let failedAtStep: number | null = null;
  let lastError: string | null = null;
  let blockedDetected = false;

  for (const step of steps ?? []) {
    // Pula approvals ja executadas/falhadas (plan-action pode ter rodado primeiro)
    if (step.status === 'executed' || step.status === 'failed') {
      executed += step.status === 'executed' ? 1 : 0;
      continue;
    }
    if (LEGACY_ACTION_TYPES.has(step.action_type)) {
      // plan-action existente eh quem executa esses; nao tentar daqui
      failedAtStep = step.plan_step_order ?? executed;
      lastError = `legacy_action_type_belongs_to_plan_action:${step.action_type}`;
      break;
    }
    const fnName = ACTION_FN_MAP[step.action_type];
    if (!fnName) {
      failedAtStep = step.plan_step_order ?? executed;
      lastError = `unknown_action_type:${step.action_type}`;
      break;
    }

    try {
      const adaptedBody = adaptPayload(step.action_type, { ...(step.payload as any), triggered_by: 'plan' });
      const result = await invokeFn(fnName, authHeader, adaptedBody);

      if (result.ledger_id) ledgerIds.push(result.ledger_id);

      if (result.blocked) {
        failedAtStep = step.plan_step_order ?? executed;
        lastError = `blocked:${result.reason}`;
        blockedDetected = true;
        break;
      }

      if (result.ok === false) {
        failedAtStep = step.plan_step_order ?? executed;
        lastError = result.error ?? 'unknown_step_failure';
        break;
      }

      executed += 1;
      await supabaseAdmin
        .from('approvals')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', step.id);
    } catch (e: any) {
      failedAtStep = step.plan_step_order ?? executed;
      lastError = e?.message ?? 'invocation_threw';
      break;
    }
  }

  const finalStatus =
    failedAtStep !== null
      ? (executed > 0 ? 'partial' : 'failed')
      : 'executed';

  await supabaseAdmin
    .from('plans')
    .update({
      status: finalStatus,
      executed_steps_count: executed,
      failed_at_step: failedAtStep,
      ledger_ids: ledgerIds,
      executed_at: new Date().toISOString(),
    })
    .eq('id', payload.plan_id);

  return jsonResponse({
    ok: finalStatus === 'executed',
    status: finalStatus,
    plan_id: payload.plan_id,
    summary: locked.human_summary,
    executed,
    total: (steps ?? []).length,
    failed_at_step: failedAtStep,
    last_error: lastError,
    blocked_by_safety: blockedDetected,
    ledger_ids: ledgerIds,
  }, 200, cors);
});
