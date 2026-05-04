# Design — agent-execution-loop (resumido, fast-track)

## Schema

### Migration `20260504000003_plan_execution.sql`

```sql
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS executed_steps_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_at_step int,
  ADD COLUMN IF NOT EXISTS ledger_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Expandir status check
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE plans ADD CONSTRAINT plans_status_check CHECK (status IN (
  'pending','approved','rejected','expired','executed','partial','failed','running','rolled_back','aborted'
));

-- approvals.action_type sem CHECK (ja eh text livre via legado)
```

## Edge Function `agent-plan-execute`

Pseudo-codigo:

```typescript
const Payload = z.object({ plan_id: z.string().uuid() });

serve(async (req) => {
  const ctx = await requireTenant(req, supabaseAdmin);
  const { plan_id } = Payload.parse(await req.json());

  // Lock atomico: so executa se status='approved'
  const { data: plan, error } = await supabaseAdmin
    .from('plans').update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', plan_id).eq('company_id', ctx.companyId).eq('status', 'approved')
    .select('id, status').maybeSingle();
  if (!plan) return jsonResponse({ error: 'plan_not_in_approved_state' }, 422);

  const { data: steps } = await supabaseAdmin
    .from('approvals').select('id, action_type, payload, plan_step_order')
    .eq('plan_id', plan_id).order('plan_step_order');

  const ledgerIds: string[] = [];
  let executed = 0;
  let failed_at: number | null = null;
  let blockedCount = 0;

  for (const step of steps ?? []) {
    try {
      // Map action_type pra Edge Fn alvo
      const fnName = mapActionTypeToFunction(step.action_type);
      const result = await invokeEdgeFn(fnName, authHeader, step.payload);

      if (result.ledger_id) ledgerIds.push(result.ledger_id);
      if (result.blocked) {
        blockedCount += 1;
        // continua pros proximos? ou para? — para por seguranca
        failed_at = step.plan_step_order;
        break;
      }
      if (!result.ok) {
        failed_at = step.plan_step_order;
        break;
      }
      executed += 1;

      // marca approval como executado
      await supabaseAdmin.from('approvals').update({ status: 'executed', executed_at: new Date().toISOString() }).eq('id', step.id);
    } catch (e) {
      failed_at = step.plan_step_order;
      break;
    }
  }

  const finalStatus =
    failed_at !== null
      ? (executed > 0 ? 'partial' : 'failed')
      : 'executed';

  await supabaseAdmin.from('plans').update({
    status: finalStatus,
    executed_steps_count: executed,
    failed_at_step: failed_at,
    ledger_ids: ledgerIds,
    executed_at: new Date().toISOString(),
  }).eq('id', plan_id);

  return jsonResponse({
    ok: finalStatus === 'executed',
    status: finalStatus,
    executed, total: steps.length, failed_at_step: failed_at, ledger_ids: ledgerIds,
  });
});
```

## Action type → Edge Fn mapping

```typescript
const ACTION_FN_MAP: Record<string, string> = {
  pause_campaign: 'action-manager',           // legado
  reactivate_campaign: 'action-manager',
  update_budget: 'action-manager',
  update_campaign: 'meta-update-campaign',    // Sprint 2
  update_adset: 'meta-update-adset',
  update_ad: 'meta-update-ad',
  shift_budget: 'meta-shift-budget',
  change_schedule: 'meta-change-schedule',
  create_customer_list_audience: 'meta-audience-create', // Sprint 3
  create_lookalike_audience: 'meta-audience-lookalike',
  create_pixel_audience: 'meta-audience-create-rule',     // Sprint 4
  create_engagement_audience: 'meta-audience-create-rule',
};
```

Para action_type legados (pause/reactivate/update_budget) o `action-manager` aceita um payload diferente — wrap em adapter dentro do executor.

## Tool `execute_plan`

```typescript
{
  name: 'execute_plan',
  description: 'Executa um plano APROVADO sequencialmente. Use APENAS apos usuario ter aprovado. Antes use propose_plan + esperar aprovacao via UI.',
  parameters: { plan_id: string }
}
```

Handler em `_shared/plan-execute-handler.ts` faz HTTP fetch pra Edge Fn.

## Frontend

- `src/types/plans.ts` — `PlanStatus`, `PlanRow`, `PlanStepRow`
- `src/hooks/use-plans.ts` — `usePlans()` (com realtime sub), `useExecutePlan()`, `useAbortPlan()`
- `src/components/plans/PlanRow.tsx` — card com summary, status badge, progress bar, expand pra ver steps
- `src/components/PlansView.tsx` — composer
- Sidebar wire (icone ListChecks)

## Decisoes

- **Sequencial, nao paralelo** — ordem importa em planos (ex: pause campanha A antes de mover budget pra B). Paralelizar exigiria DAG, fora de scope.
- **Para no primeiro fail** — em vez de tentar todos. Razao: planos tendem a ser inter-dependentes; um fail no meio significa estado inconsistente, nao "quase pronto".
- **Capturar ledger_ids em vez de fazer rollback inline** — rollback eh complexo (precisa de logica per-action_type pra reverter), e melhor entregar a infra agora e implementar reverse logic em sprint dedicada.
- **partial vs failed** — se >0 steps deram certo, status='partial' (mostra UI diferente — usuario decide rollback ou seguir manual).
- **Realtime via supabase.channel** — UI sub em plans changes, sem polling.
