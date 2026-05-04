# Design — meta-edits-suite

## Arquitetura

5 Edge Functions novas, todas seguem o mesmo padrao:

```
chat/UI -> tool -> Edge Fn (meta-update-X) ->
  1. JWT -> companyId (tenant-guard)
  2. Zod validate
  3. resolve external_id (local or direct)
  4. estimate cost_brl
  5. withSafetyRails(...)
     - if blocked: return 429 com block_reason
     - if simulated: return ok com simulated:true (NAO chama Meta)
     - if executed:
        a. pre-flight read (GET /{external_id}) — drift check
        b. PATCH/POST Meta API
        c. local UPDATE com fields novos
        d. fire meta-sync incremental (best-effort)
        e. return response com {ok, drift_detected, ledger_id, ...}
```

## Schema delta

Nenhuma tabela nova! Apenas:

### Migration: `20260503000002_meta_edits_columns.sql`

```sql
-- adicionar campos updated_at em campaigns/adsets/creatives se ainda nao existirem
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS local_updated_at timestamptz;
ALTER TABLE adsets ADD COLUMN IF NOT EXISTS local_updated_at timestamptz;
-- adsets ja existe da deep-scan; ad-level table nao temos local — usamos creatives

-- view util pra UI
CREATE OR REPLACE VIEW v_editable_campaigns AS
SELECT
  c.id, c.company_id, c.external_id, c.name, c.status, c.objective,
  c.daily_budget, c.lifetime_budget, c.bid_strategy,
  c.start_time, c.stop_time,
  c.local_updated_at,
  (SELECT COUNT(*) FROM adsets a WHERE a.campaign_id = c.id) AS adset_count
FROM campaigns c
WHERE c.status NOT IN ('DELETED','ARCHIVED');

-- RPC pra UI calcular preview de impacto
CREATE OR REPLACE FUNCTION estimate_budget_change_impact(
  p_campaign_id uuid,
  p_new_daily_budget numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_current numeric; v_diff numeric; v_30d_projection numeric;
  v_company_id uuid;
BEGIN
  SELECT company_id, daily_budget INTO v_company_id, v_current
    FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  v_diff := p_new_daily_budget - COALESCE(v_current, 0);
  v_30d_projection := p_new_daily_budget * 30;

  RETURN jsonb_build_object(
    'current_daily', v_current,
    'new_daily', p_new_daily_budget,
    'delta_brl', v_diff,
    'delta_pct', CASE WHEN v_current > 0 THEN ROUND((v_diff / v_current) * 100, 2) ELSE NULL END,
    '30d_projection', v_30d_projection
  );
END $$;

GRANT EXECUTE ON FUNCTION estimate_budget_change_impact TO authenticated;
```

## Edge Functions

### Estrutura comum: `_shared/meta-edits-helpers.ts`

```typescript
export interface MetaEditContext {
  companyId: string;
  userId: string;
  metaToken: string;
  adAccountId: string; // act_XXXX
}

export async function resolveMetaContext(req: Request, supabaseAdmin: SupabaseClient): Promise<MetaEditContext> {
  const { companyId, userId } = await requireTenant(req, supabaseAdmin);
  // pega integration ativa + decrypt token
  const { data: integ, error } = await supabaseAdmin
    .from('integrations').select('access_token, meta_business_id')
    .eq('company_id', companyId).eq('platform', 'meta').single();
  if (error || !integ) throw new Error('no_meta_integration');
  const { data: token } = await supabaseAdmin.rpc('decrypt_meta_token', { encrypted_token: integ.access_token });
  // pega ad_account principal
  const { data: acc } = await supabaseAdmin.from('meta_ad_accounts').select('external_id').eq('company_id', companyId).limit(1).single();
  if (!acc) throw new Error('no_ad_account_selected');
  return { companyId, userId, metaToken: token, adAccountId: acc.external_id };
}

export async function metaPatch(externalId: string, fields: Record<string, any>, token: string): Promise<any> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  params.set('access_token', token);
  const res = await fetch(`https://graph.facebook.com/v22.0/${externalId}`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new MetaApiError(err.error?.message ?? 'meta_api_error', err.error?.code);
  }
  return res.json();
}

export async function metaGet(externalId: string, fields: string[], token: string): Promise<any> {
  const url = `https://graph.facebook.com/v22.0/${externalId}?fields=${fields.join(',')}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new MetaApiError(`get_failed`, res.status);
  return res.json();
}

export async function preflightDriftCheck(
  externalId: string, fieldsToCheck: string[], localState: Record<string, any>, token: string
): Promise<{ drift: boolean; remote: any }> {
  const remote = await metaGet(externalId, fieldsToCheck, token);
  for (const f of fieldsToCheck) {
    if (remote[f] !== undefined && localState[f] !== undefined && String(remote[f]) !== String(localState[f])) {
      return { drift: true, remote };
    }
  }
  return { drift: false, remote };
}
```

### `meta-update-campaign/index.ts`

Pseudo-codigo:
```typescript
const ZodPayload = z.object({
  campaign_id: z.string().uuid().optional(),
  campaign_external_id: z.string().optional(),
  name: z.string().max(250).optional(),
  status: z.enum(['ACTIVE','PAUSED']).optional(),
  daily_budget: z.number().min(5).optional(),
  lifetime_budget: z.number().min(50).optional(),
  bid_strategy: z.enum(['LOWEST_COST_WITHOUT_CAP','LOWEST_COST_WITH_BID_CAP','COST_CAP']).optional(),
  bid_amount: z.number().positive().optional(),
  start_time: z.string().datetime().optional(),
  stop_time: z.string().datetime().optional(),
  force: z.boolean().default(false),
  triggered_by: z.enum(['user','agent','rule','plan']).default('user'),
}).refine(d => d.campaign_id || d.campaign_external_id, 'need either id');

serve(async (req) => {
  const ctx = await resolveMetaContext(req, supabaseAdmin);
  const payload = ZodPayload.parse(await req.json());

  // resolve external_id
  let externalId = payload.campaign_external_id;
  let localCampaign;
  if (!externalId) {
    const { data } = await supabaseAdmin.from('campaigns').select('*').eq('id', payload.campaign_id).single();
    if (!data || data.company_id !== ctx.companyId) return jsonResponse({ error: 'not_found' }, 404);
    localCampaign = data;
    externalId = data.external_id;
  }

  // estimate cost
  const newDaily = payload.daily_budget ?? localCampaign?.daily_budget ?? 0;
  const oldDaily = localCampaign?.daily_budget ?? 0;
  const delta = newDaily - oldDaily;
  const costBrlEstimate = delta > 0 ? delta * 30 : 0; // so contabiliza aumento

  const actionKind = delta > 0 ? 'update_budget_up' : (delta < 0 ? 'update_budget_down' : 'update_campaign');

  return await withSafetyRails(supabaseAdmin, {
    companyId: ctx.companyId,
    agentName: 'meta-update-campaign',
    actionKind,
    costBrlEstimate,
    triggeredBy: payload.triggered_by,
    triggeredById: ctx.userId,
    payload,
    targetKind: 'campaign',
    targetExternalId: externalId,
  }, async () => {
    // pre-flight drift
    if (!payload.force) {
      const fieldsToCheck = ['status','daily_budget','lifetime_budget'];
      const { drift, remote } = await preflightDriftCheck(externalId, fieldsToCheck, localCampaign, ctx.metaToken);
      if (drift) {
        await supabaseAdmin.from('campaigns').update({ status: remote.status, daily_budget: remote.daily_budget, local_updated_at: new Date() }).eq('external_id', externalId);
        throw new Error(`drift_detected: remote state diverged from local — sync forced, retry`);
      }
    }

    // monta fields meta-side (centavos)
    const metaFields: Record<string, any> = {};
    if (payload.name) metaFields.name = payload.name;
    if (payload.status) metaFields.status = payload.status;
    if (payload.daily_budget !== undefined) metaFields.daily_budget = Math.round(payload.daily_budget * 100);
    if (payload.lifetime_budget !== undefined) metaFields.lifetime_budget = Math.round(payload.lifetime_budget * 100);
    if (payload.bid_strategy) metaFields.bid_strategy = payload.bid_strategy;
    if (payload.bid_amount !== undefined) metaFields.bid_amount = Math.round(payload.bid_amount * 100);
    if (payload.start_time) metaFields.start_time = payload.start_time;
    if (payload.stop_time) metaFields.stop_time = payload.stop_time;

    const result = await metaPatch(externalId, metaFields, ctx.metaToken);

    // local UPDATE
    const localPatch: Record<string, any> = { local_updated_at: new Date() };
    for (const k of Object.keys(metaFields)) {
      if (k === 'daily_budget' || k === 'lifetime_budget' || k === 'bid_amount') {
        localPatch[k] = (metaFields[k] as number) / 100; // back to BRL
      } else {
        localPatch[k] = payload[k as keyof typeof payload];
      }
    }
    await supabaseAdmin.from('campaigns').update(localPatch).eq('external_id', externalId);

    return { ok: true, externalId, fields_updated: Object.keys(metaFields), meta_response: result };
  })
  .then(({ result, gate, ledgerId, executed }) => {
    if (!executed) {
      return jsonResponse({ ok: false, blocked: true, reason: gate.block_reason, gate, ledger_id: ledgerId }, 429);
    }
    return jsonResponse({ ok: true, ...result, ledger_id: ledgerId, sandbox: gate.sandbox ?? false });
  })
  .catch(err => jsonResponse({ error: err.message }, 500));
});
```

(Os outros 4 Edge Fns seguem essa estrutura — variando fields validados e tipo de target.)

## Tools no chat

### `_shared/tools.ts` — adicionar 5 tools

```typescript
export const META_EDITS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_campaign',
      description: 'Atualiza uma campanha existente no Meta Ads (budget, status, name, bid strategy, schedule). Use quando o usuario pedir pra editar uma campanha ja existente, NAO use pra criar.',
      parameters: { /* JSON schema do ZodPayload */ }
    }
  },
  // ... update_adset, update_ad, shift_budget, change_schedule
];
```

E handlers em `_shared/edits-tool-handlers.ts` que chamam Edge Fns via fetch HTTP com user JWT.

## Frontend

### Hook: `src/hooks/use-meta-edits.ts`

```typescript
export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateCampaignPayload) => {
      const { data, error } = await supabase.functions.invoke('meta-update-campaign', { body: payload });
      if (error) throw error;
      if (!data.ok) throw new MetaEditError(data.reason ?? 'unknown', data);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['safety-status'] });
    }
  });
}
// idem useUpdateAdset, useUpdateAd, useShiftBudget, useChangeSchedule
```

### View "Otimizacao"

`src/components/optimization/OptimizationView.tsx`:
- Lista de campanhas via `useCampaigns()` (existente) + filtro status
- Click expand mostra `CampaignEditPanel`
- Panel tem 4 sub-secoes: Budget / Bid / Schedule / Status
- Cada campo com inline-edit (click pra editar, save dispara mutation)
- Preview de impacto via `estimate_budget_change_impact` RPC antes do submit
- Toast com sandbox warning quando aplicavel

## Tipos

`src/types/meta-edits.ts`:
```typescript
export type BidStrategy = 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP';
export type AdsetOptimizationGoal = 'LINK_CLICKS' | 'OFFSITE_CONVERSIONS' | 'LANDING_PAGE_VIEWS' | 'POST_ENGAGEMENT' | 'REACH' | 'IMPRESSIONS';

export interface UpdateCampaignPayload {
  campaign_id?: string;
  campaign_external_id?: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  daily_budget?: number;
  lifetime_budget?: number;
  bid_strategy?: BidStrategy;
  bid_amount?: number;
  start_time?: string;
  stop_time?: string;
  force?: boolean;
  triggered_by?: 'user' | 'agent' | 'rule' | 'plan';
}

// idem UpdateAdsetPayload, UpdateAdPayload, ShiftBudgetPayload, ChangeSchedulePayload
```

## Safety integration

Cada Edge Fn passa `triggered_by` que vem do tool/UI:
- UI direto -> 'user'
- Tool no chat -> 'agent'
- FURY rule -> 'rule'
- Plan step -> 'plan'

Pra acoes via 'user', o threshold `require_approval_above_brl` ainda se aplica (user pode confirmar via approval flow).

## Decisoes

### Por que pre-flight drift check?
Concorrencia: usuario pode mexer direto no Ads Manager enquanto agente edita. Sem drift check, sobrescrevemos mudanca do usuario. Com drift check, alertamos e re-sync. `force=true` skipa (use case: agente sabendo que esta corrigindo o que usuario fez).

### Por que centavos so dentro da Edge Fn?
DB local em BRL (consistencia com dashboard). Conversao centavos so na borda Meta API. Evita confusao em logs.

### Por que `local_updated_at` separado de `updated_at`?
`updated_at` e atualizado tambem por meta-sync (refresh). `local_updated_at` so quando NOSSA edicao mexeu — ajuda detectar concorrencia: se `local_updated_at < updated_at`, sync sobrescreveu nossa edicao.

### Por que NAO criar tabela `ad_edits_history`?
O ledger ja registra. Adicionar tabela seria duplicar. Query de historico de edits = `SELECT * FROM agent_action_ledger WHERE action_kind LIKE 'update_%'`.
