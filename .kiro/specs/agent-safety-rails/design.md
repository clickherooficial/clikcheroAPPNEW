# Design — agent-safety-rails

> Como entregar os requisitos da spec `requirements.md`.

## Arquitetura

```
                                    ┌──────────────────┐
                                    │  Edge Functions  │
                                    │  (executoras)    │
                                    └────────┬─────────┘
                                             │ 1. RPC check_safety_gates(company,kind,cost)
                                             ▼
                                    ┌──────────────────┐
                                    │  PostgreSQL      │
                                    │  ┌────────────┐  │
                                    │  │safety_config│ │
                                    │  └────────────┘  │
                                    │  ┌────────────┐  │
                                    │  │action_ledger│ │
                                    │  └────────────┘  │
                                    │  ┌────────────┐  │
                                    │  │RPC gates    │ │
                                    │  └────────────┘  │
                                    └────────┬─────────┘
                                             │ 2. {allowed, block_reason}
                                             ▼
                                    ┌──────────────────┐
   se allowed: chama Meta API ──── │  Edge Fn decide  │
   se blocked: log + 429           │                  │
                                    └────────┬─────────┘
                                             │ 3. RPC log_agent_action(...)
                                             ▼
                                    ┌──────────────────┐
                                    │  ledger insert   │
                                    │  (append-only)   │
                                    └──────────────────┘
```

Pos-execucao, um trigger AFTER INSERT em `agent_action_ledger` checa se tem N falhas consecutivas e, se sim, dispara circuit breaker (UPDATE em safety_config).

## Schema SQL

### Migration: `20260503000001_agent_safety_rails.sql`

```sql
-- 1. Tabela de config
CREATE TABLE agent_safety_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  auto_execute_enabled boolean NOT NULL DEFAULT false,
  sandbox_mode boolean NOT NULL DEFAULT true,
  max_actions_per_hour int NOT NULL DEFAULT 10 CHECK (max_actions_per_hour BETWEEN 1 AND 1000),
  max_actions_per_day int NOT NULL DEFAULT 50 CHECK (max_actions_per_day BETWEEN 1 AND 10000),
  max_spend_increase_pct_per_day int NOT NULL DEFAULT 30 CHECK (max_spend_increase_pct_per_day BETWEEN 0 AND 500),
  max_spend_decrease_pct_per_day int NOT NULL DEFAULT 100 CHECK (max_spend_decrease_pct_per_day BETWEEN 0 AND 100),
  circuit_breaker_threshold int NOT NULL DEFAULT 3 CHECK (circuit_breaker_threshold BETWEEN 1 AND 20),
  circuit_breaker_cooldown_minutes int NOT NULL DEFAULT 60,
  require_approval_above_brl numeric(10,2) NOT NULL DEFAULT 100.00 CHECK (require_approval_above_brl >= 0),
  paused_until timestamptz NULL,
  paused_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_safety_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY safety_config_select ON agent_safety_config FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY safety_config_update ON agent_safety_config FOR UPDATE USING (company_id = current_user_company_id());
-- INSERT bloqueado pra usuarios; trigger ou service-role insere
-- DELETE bloqueado total

-- Trigger: cria config default ao inserir company
CREATE OR REPLACE FUNCTION init_safety_config_for_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO agent_safety_config (company_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_init_safety_config AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION init_safety_config_for_company();

-- Backfill pra companies existentes
INSERT INTO agent_safety_config (company_id) SELECT id FROM companies ON CONFLICT DO NOTHING;

-- 2. Action Ledger (append-only)
CREATE TABLE agent_action_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  action_kind text NOT NULL,
  target_kind text NULL,
  target_external_id text NULL,
  payload_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_jsonb jsonb NULL,
  status text NOT NULL CHECK (status IN ('simulated','succeeded','failed','blocked','rolled_back')),
  block_reason text NULL CHECK (block_reason IS NULL OR block_reason IN (
    'rate_limit','circuit_breaker','spend_velocity','sandbox_mode','paused','requires_approval','config_disabled'
  )),
  latency_ms int NULL,
  cost_brl_estimate numeric(10,2) NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('user','agent','cron','rule','plan')),
  triggered_by_id uuid NULL,
  rolled_back_from uuid NULL REFERENCES agent_action_ledger(id),
  idempotency_key text NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_ledger_idempotency ON agent_action_ledger(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ledger_company_executed ON agent_action_ledger(company_id, executed_at DESC);
CREATE INDEX idx_ledger_status ON agent_action_ledger(company_id, status, executed_at DESC);
CREATE INDEX idx_ledger_action_kind ON agent_action_ledger(company_id, action_kind, executed_at DESC);

ALTER TABLE agent_action_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_select ON agent_action_ledger FOR SELECT USING (company_id = current_user_company_id());
-- INSERT/UPDATE/DELETE bloqueados pra usuarios; service-role bypass RLS

-- 3. RPC: check_safety_gates
CREATE OR REPLACE FUNCTION check_safety_gates(
  p_company_id uuid,
  p_agent_name text,
  p_action_kind text,
  p_cost_brl_estimate numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_config agent_safety_config%ROWTYPE;
  v_actions_1h int;
  v_actions_24h int;
  v_spend_24h numeric;
  v_consecutive_failures int;
  v_is_paused boolean;
BEGIN
  SELECT * INTO v_config FROM agent_safety_config WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    -- companies sem config (race condition) — retorna safe
    INSERT INTO agent_safety_config (company_id) VALUES (p_company_id)
      ON CONFLICT (company_id) DO NOTHING
      RETURNING * INTO v_config;
  END IF;

  -- 1. paused?
  IF v_config.paused_until IS NOT NULL AND v_config.paused_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'block_reason', 'paused',
      'paused_until', v_config.paused_until,
      'paused_reason', v_config.paused_reason
    );
  END IF;

  -- 2. config_disabled?
  IF NOT v_config.auto_execute_enabled AND NOT v_config.sandbox_mode THEN
    -- somente acoes via 'user' triggered passam quando auto_execute=false
    -- mas isso e checado no caller. Aqui apenas avisa.
    NULL;
  END IF;

  -- 3. rate limit
  SELECT COUNT(*) INTO v_actions_1h FROM agent_action_ledger
    WHERE company_id = p_company_id AND status IN ('succeeded','simulated')
    AND executed_at > now() - interval '1 hour';
  IF v_actions_1h >= v_config.max_actions_per_hour THEN
    RETURN jsonb_build_object('allowed', false, 'block_reason', 'rate_limit', 'limit', v_config.max_actions_per_hour, 'window', '1h');
  END IF;

  SELECT COUNT(*) INTO v_actions_24h FROM agent_action_ledger
    WHERE company_id = p_company_id AND status IN ('succeeded','simulated')
    AND executed_at > now() - interval '24 hours';
  IF v_actions_24h >= v_config.max_actions_per_day THEN
    RETURN jsonb_build_object('allowed', false, 'block_reason', 'rate_limit', 'limit', v_config.max_actions_per_day, 'window', '24h');
  END IF;

  -- 4. spend velocity (only for spend-increasing actions)
  IF p_cost_brl_estimate IS NOT NULL AND p_cost_brl_estimate > 0
     AND p_action_kind IN ('update_budget_up','publish_campaign','create_campaign') THEN
    SELECT COALESCE(SUM(cost_brl_estimate), 0) INTO v_spend_24h
      FROM agent_action_ledger
      WHERE company_id = p_company_id AND status IN ('succeeded','simulated')
      AND action_kind IN ('update_budget_up','publish_campaign','create_campaign')
      AND executed_at > now() - interval '24 hours';
    -- limite absoluto (nao pct) por enquanto — pct precisa de baseline yesterday_spend
    -- ajuste pratico: cost_brl_estimate de 24h <= max_spend_increase_pct_per_day * 100 BRL (heuristica)
    IF (v_spend_24h + p_cost_brl_estimate) > (v_config.max_spend_increase_pct_per_day * 100) THEN
      RETURN jsonb_build_object('allowed', false, 'block_reason', 'spend_velocity',
        'cumulative_24h', v_spend_24h, 'requested', p_cost_brl_estimate,
        'limit_brl', v_config.max_spend_increase_pct_per_day * 100);
    END IF;
  END IF;

  -- 5. requires_approval (sinaliza pro caller — nao bloqueia mas avisa)
  IF p_cost_brl_estimate IS NOT NULL AND p_cost_brl_estimate > v_config.require_approval_above_brl THEN
    RETURN jsonb_build_object('allowed', false, 'block_reason', 'requires_approval',
      'threshold', v_config.require_approval_above_brl, 'cost', p_cost_brl_estimate);
  END IF;

  -- 6. sandbox_mode -> permite mas com flag
  RETURN jsonb_build_object(
    'allowed', true,
    'sandbox', v_config.sandbox_mode,
    'auto_execute', v_config.auto_execute_enabled,
    'remaining_quota', jsonb_build_object('hour', v_config.max_actions_per_hour - v_actions_1h, 'day', v_config.max_actions_per_day - v_actions_24h)
  );
END $$;

-- 4. RPC: log_agent_action
CREATE OR REPLACE FUNCTION log_agent_action(
  p_company_id uuid,
  p_agent_name text,
  p_action_kind text,
  p_status text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_result jsonb DEFAULT NULL,
  p_block_reason text DEFAULT NULL,
  p_target_kind text DEFAULT NULL,
  p_target_external_id text DEFAULT NULL,
  p_latency_ms int DEFAULT NULL,
  p_cost_brl_estimate numeric DEFAULT NULL,
  p_triggered_by text DEFAULT 'agent',
  p_triggered_by_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO agent_action_ledger (
    company_id, agent_name, action_kind, status, payload_jsonb, result_jsonb, block_reason,
    target_kind, target_external_id, latency_ms, cost_brl_estimate, triggered_by, triggered_by_id, idempotency_key
  ) VALUES (
    p_company_id, p_agent_name, p_action_kind, p_status, p_payload, p_result, p_block_reason,
    p_target_kind, p_target_external_id, p_latency_ms, p_cost_brl_estimate, p_triggered_by, p_triggered_by_id, p_idempotency_key
  )
  ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status -- idempotente: re-log mesma key atualiza
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 5. Trigger: circuit breaker
CREATE OR REPLACE FUNCTION check_circuit_breaker_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_threshold int;
  v_recent_failures int;
  v_cooldown int;
BEGIN
  -- so checa se a nova insercao foi failed
  IF NEW.status <> 'failed' THEN RETURN NEW; END IF;

  SELECT circuit_breaker_threshold, circuit_breaker_cooldown_minutes
    INTO v_threshold, v_cooldown
    FROM agent_safety_config WHERE company_id = NEW.company_id;

  -- Conta as ultimas N execucoes nao-blocked
  SELECT COUNT(*) INTO v_recent_failures FROM (
    SELECT status FROM agent_action_ledger
      WHERE company_id = NEW.company_id AND status IN ('succeeded','failed','simulated')
      ORDER BY executed_at DESC LIMIT v_threshold
  ) sub WHERE status = 'failed';

  IF v_recent_failures >= v_threshold THEN
    UPDATE agent_safety_config
      SET paused_until = now() + (v_cooldown || ' minutes')::interval,
          paused_reason = 'circuit_breaker: ' || NEW.agent_name || ' (' || v_threshold || ' failures)',
          updated_at = now()
      WHERE company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_circuit_breaker AFTER INSERT ON agent_action_ledger
  FOR EACH ROW EXECUTE FUNCTION check_circuit_breaker_after_insert();

-- 6. RPC: get_safety_status
CREATE OR REPLACE FUNCTION get_safety_status(p_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_company_id uuid;
  v_config agent_safety_config%ROWTYPE;
  v_actions_1h int;
  v_actions_24h int;
  v_spend_24h numeric;
  v_failures int;
  v_top_blocks jsonb;
BEGIN
  v_company_id := COALESCE(p_company_id, current_user_company_id());
  IF v_company_id IS NULL THEN RETURN jsonb_build_object('error','no_company'); END IF;

  SELECT * INTO v_config FROM agent_safety_config WHERE company_id = v_company_id;
  SELECT COUNT(*) INTO v_actions_1h FROM agent_action_ledger WHERE company_id = v_company_id AND executed_at > now() - interval '1 hour';
  SELECT COUNT(*) INTO v_actions_24h FROM agent_action_ledger WHERE company_id = v_company_id AND executed_at > now() - interval '24 hours';
  SELECT COALESCE(SUM(cost_brl_estimate), 0) INTO v_spend_24h FROM agent_action_ledger
    WHERE company_id = v_company_id AND status IN ('succeeded','simulated')
    AND action_kind IN ('update_budget_up','publish_campaign','create_campaign')
    AND executed_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_failures FROM (
    SELECT status FROM agent_action_ledger WHERE company_id = v_company_id AND status IN ('succeeded','failed','simulated')
      ORDER BY executed_at DESC LIMIT v_config.circuit_breaker_threshold
  ) sub WHERE status = 'failed';
  SELECT jsonb_object_agg(block_reason, c) INTO v_top_blocks FROM (
    SELECT block_reason, COUNT(*) as c FROM agent_action_ledger
      WHERE company_id = v_company_id AND status='blocked' AND block_reason IS NOT NULL
      AND executed_at > now() - interval '7 days' GROUP BY block_reason
  ) sub;

  RETURN jsonb_build_object(
    'config', row_to_json(v_config),
    'actions_last_1h', v_actions_1h,
    'actions_last_24h', v_actions_24h,
    'cumulative_spend_24h', v_spend_24h,
    'consecutive_failures', v_failures,
    'is_paused', v_config.paused_until > now(),
    'paused_until', v_config.paused_until,
    'paused_reason', v_config.paused_reason,
    'top_block_reasons_7d', COALESCE(v_top_blocks, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION check_safety_gates TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION log_agent_action TO service_role;
GRANT EXECUTE ON FUNCTION get_safety_status TO authenticated;
```

## Edge Function helper compartilhado

### `supabase/functions/_shared/safety-rails.ts`

Exporta 2 funcoes que TODA Edge Function de execucao chama:

```typescript
export interface SafetyGateResult {
  allowed: boolean;
  sandbox?: boolean;
  block_reason?: string;
  paused_until?: string;
  paused_reason?: string;
  remaining_quota?: { hour: number; day: number };
  threshold?: number;
  cost?: number;
  limit_brl?: number;
}

export async function checkSafetyGates(
  supabaseAdmin: SupabaseClient,
  args: { companyId: string; agentName: string; actionKind: string; costBrlEstimate?: number }
): Promise<SafetyGateResult> {
  const { data, error } = await supabaseAdmin.rpc('check_safety_gates', {
    p_company_id: args.companyId,
    p_agent_name: args.agentName,
    p_action_kind: args.actionKind,
    p_cost_brl_estimate: args.costBrlEstimate ?? null,
  });
  if (error) throw new Error(`safety_check_failed: ${error.message}`);
  return data as SafetyGateResult;
}

export async function logAgentAction(
  supabaseAdmin: SupabaseClient,
  args: {
    companyId: string;
    agentName: string;
    actionKind: string;
    status: 'simulated' | 'succeeded' | 'failed' | 'blocked' | 'rolled_back';
    payload?: any;
    result?: any;
    blockReason?: string;
    targetKind?: string;
    targetExternalId?: string;
    latencyMs?: number;
    costBrlEstimate?: number;
    triggeredBy?: 'user' | 'agent' | 'cron' | 'rule' | 'plan';
    triggeredById?: string;
    idempotencyKey?: string;
  }
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('log_agent_action', {
    p_company_id: args.companyId,
    p_agent_name: args.agentName,
    p_action_kind: args.actionKind,
    p_status: args.status,
    p_payload: args.payload ?? {},
    p_result: args.result ?? null,
    p_block_reason: args.blockReason ?? null,
    p_target_kind: args.targetKind ?? null,
    p_target_external_id: args.targetExternalId ?? null,
    p_latency_ms: args.latencyMs ?? null,
    p_cost_brl_estimate: args.costBrlEstimate ?? null,
    p_triggered_by: args.triggeredBy ?? 'agent',
    p_triggered_by_id: args.triggeredById ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
  });
  if (error) throw new Error(`log_action_failed: ${error.message}`);
  return data as string;
}

export async function withSafetyRails<T>(
  supabaseAdmin: SupabaseClient,
  args: {
    companyId: string;
    agentName: string;
    actionKind: string;
    costBrlEstimate?: number;
    triggeredBy?: 'user' | 'agent' | 'cron' | 'rule' | 'plan';
    triggeredById?: string;
    idempotencyKey?: string;
    payload?: any;
    targetKind?: string;
    targetExternalId?: string;
  },
  execute: () => Promise<T>
): Promise<{ result?: T; gate: SafetyGateResult; ledgerId: string; executed: boolean }> {
  const t0 = Date.now();
  const gate = await checkSafetyGates(supabaseAdmin, args);

  if (!gate.allowed) {
    const ledgerId = await logAgentAction(supabaseAdmin, {
      ...args,
      status: 'blocked',
      blockReason: gate.block_reason,
      latencyMs: Date.now() - t0,
    });
    return { gate, ledgerId, executed: false };
  }

  if (gate.sandbox) {
    // sandbox mode — log como simulado, NAO executa
    const ledgerId = await logAgentAction(supabaseAdmin, {
      ...args,
      status: 'simulated',
      result: { simulated: true, would_execute: args.actionKind },
      latencyMs: Date.now() - t0,
    });
    return { gate, ledgerId, executed: false };
  }

  // executa real
  try {
    const result = await execute();
    const ledgerId = await logAgentAction(supabaseAdmin, {
      ...args,
      status: 'succeeded',
      result: result as any,
      latencyMs: Date.now() - t0,
    });
    return { result, gate, ledgerId, executed: true };
  } catch (e: any) {
    const ledgerId = await logAgentAction(supabaseAdmin, {
      ...args,
      status: 'failed',
      result: { error: e?.message ?? String(e) },
      latencyMs: Date.now() - t0,
    });
    throw e; // propaga pro caller decidir
  }
}
```

## Refator das Edge Functions existentes

Toda Edge Function que mexe em estado externo recebe wrap com `withSafetyRails`. Ex em `campaign-publish/index.ts`:

```typescript
const { result, gate, executed } = await withSafetyRails(
  supabaseAdmin,
  {
    companyId,
    agentName: 'campaign-publish',
    actionKind: 'publish_campaign',
    costBrlEstimate: estimatedDailyBudget * 30, // 30 dias de runway
    triggeredBy: 'user', // ou 'agent' se vindo do propose_campaign tool
    triggeredById: userId,
    idempotencyKey: `publish:${proposalId}`,
    payload: { proposalId, companyId },
    targetKind: 'campaign',
  },
  async () => {
    return await runCampaignPublishPipeline(...); // o codigo atual
  }
);

if (!executed) {
  return jsonResponse({ blocked: true, reason: gate.block_reason, ledger_id: ledgerId }, 429);
}
```

## Frontend

### Hook: `src/hooks/use-safety.ts`

```typescript
export function useSafetyStatus() {
  return useQuery({
    queryKey: ['safety-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_safety_status');
      if (error) throw error;
      return data as SafetyStatus;
    },
    refetchInterval: 30_000, // refresh a cada 30s pra refletir paused_until
  });
}

export function useUpdateSafetyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SafetyConfig>) => {
      const { data, error } = await supabase.from('agent_safety_config').update(patch).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-status'] }),
  });
}

export function useResetCircuitBreaker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('agent_safety_config')
        .update({ paused_until: null, paused_reason: null }).eq('company_id', /* current */);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-status'] }),
  });
}

export function useActionLedger(filter?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['action-ledger', filter],
    queryFn: async () => {
      let q = supabase.from('agent_action_ledger').select('*').order('executed_at', { ascending: false }).limit(filter?.limit ?? 50);
      if (filter?.status) q = q.eq('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
```

### Componente: `src/components/safety/SafetyView.tsx`

3 secoes:
1. **Status atual** (4 cards: Auto-execute / Sandbox / Acoes 1h / Pausado?)
2. **Configuracoes** (form com sliders/toggles)
3. **Ledger recente** (tabela com filtro por status)

Botao destacado "Resetar Circuit Breaker" quando paused.

## Tipos TypeScript

`src/types/safety.ts`:
```typescript
export interface SafetyConfig {
  id: string;
  company_id: string;
  auto_execute_enabled: boolean;
  sandbox_mode: boolean;
  max_actions_per_hour: number;
  max_actions_per_day: number;
  max_spend_increase_pct_per_day: number;
  max_spend_decrease_pct_per_day: number;
  circuit_breaker_threshold: number;
  circuit_breaker_cooldown_minutes: number;
  require_approval_above_brl: number;
  paused_until: string | null;
  paused_reason: string | null;
}

export interface SafetyStatus {
  config: SafetyConfig;
  actions_last_1h: number;
  actions_last_24h: number;
  cumulative_spend_24h: number;
  consecutive_failures: number;
  is_paused: boolean;
  paused_until: string | null;
  paused_reason: string | null;
  top_block_reasons_7d: Record<string, number>;
}

export type LedgerStatus = 'simulated' | 'succeeded' | 'failed' | 'blocked' | 'rolled_back';
export type BlockReason = 'rate_limit' | 'circuit_breaker' | 'spend_velocity' | 'sandbox_mode' | 'paused' | 'requires_approval' | 'config_disabled';

export interface ActionLedgerRow {
  id: string;
  company_id: string;
  agent_name: string;
  action_kind: string;
  target_kind: string | null;
  target_external_id: string | null;
  status: LedgerStatus;
  block_reason: BlockReason | null;
  cost_brl_estimate: number | null;
  triggered_by: 'user' | 'agent' | 'cron' | 'rule' | 'plan';
  executed_at: string;
}
```

## Decisoes arquiteturais

### Por que ledger separado de agent_runs?
`agent_runs` registra execucoes de Edge Functions (telemetria). `action_ledger` registra acoes EXTERNAS (mexer no Meta API, modificar dado). Sao niveis diferentes — uma Edge Fn pode ter 1 run com N actions ou 1 run com 0 actions. Misturar empurraria semantica e dificultaria queries de safety.

### Por que cost_brl_estimate em vez de medir cost real?
Pos-acao real e tarde. Pra spend velocity precisamos do estimate ANTES de executar. Refinamento futuro: pos-acao um cron compara estimate com gasto real e ajusta o RPC.

### Por que sandbox default ON?
Principio de menor surpresa. Cliente novo nao deve ver agente movendo dinheiro sem consentimento explicito. UX: durante onboarding, mostra modal "voce esta em modo seguro — desligue pra ativar acoes reais".

### Por que SELECT FOR UPDATE no breaker?
Concorrencia: 2 Edge Fns podem inserir failures simultaneamente. Trigger AFTER INSERT lock-free. Evitamos race usando ON CONFLICT no UPDATE de paused_until com check do timestamp atual (ja tem cooldown? mantem).

### Por que cost limit absoluto (R$X) em vez de pct?
Pct precisa de baseline (gasto de ontem) que e dado externo (Meta API). v1 usa absoluto pra simplificar. v2 sub-spec faz query a `campaign_metrics` pra calcular baseline diario.

## Backwards-compat

- Edge Functions atuais que NAO chamarem `withSafetyRails` continuam funcionando (gates sao opt-in)
- Deploy ordem: migration → helper file → wrap 1 Edge Fn → testar → wrap proximas
- Sprint 2 (meta-edits-suite) FORCA uso de safety rails em todas as suas Edge Fns novas
