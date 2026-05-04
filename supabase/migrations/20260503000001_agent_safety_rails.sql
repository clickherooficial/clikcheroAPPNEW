-- ============================================================================
-- agent-safety-rails (Sprint 1/8) — trilhos de seguranca pre-execucao
-- Spec: .kiro/specs/agent-safety-rails/
-- Data: 2026-05-03
-- ============================================================================

-- 1. Tabela de configuracao por company
CREATE TABLE IF NOT EXISTS agent_safety_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  auto_execute_enabled boolean NOT NULL DEFAULT false,
  sandbox_mode boolean NOT NULL DEFAULT true,
  max_actions_per_hour int NOT NULL DEFAULT 10 CHECK (max_actions_per_hour BETWEEN 1 AND 1000),
  max_actions_per_day int NOT NULL DEFAULT 50 CHECK (max_actions_per_day BETWEEN 1 AND 10000),
  max_spend_increase_pct_per_day int NOT NULL DEFAULT 30 CHECK (max_spend_increase_pct_per_day BETWEEN 0 AND 500),
  max_spend_decrease_pct_per_day int NOT NULL DEFAULT 100 CHECK (max_spend_decrease_pct_per_day BETWEEN 0 AND 100),
  circuit_breaker_threshold int NOT NULL DEFAULT 3 CHECK (circuit_breaker_threshold BETWEEN 1 AND 20),
  circuit_breaker_cooldown_minutes int NOT NULL DEFAULT 60 CHECK (circuit_breaker_cooldown_minutes BETWEEN 1 AND 1440),
  require_approval_above_brl numeric(10, 2) NOT NULL DEFAULT 100.00 CHECK (require_approval_above_brl >= 0),
  paused_until timestamptz NULL,
  paused_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_config_paused ON agent_safety_config(paused_until) WHERE paused_until IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_safety_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_safety_config_updated_at ON agent_safety_config;
CREATE TRIGGER trg_safety_config_updated_at BEFORE UPDATE ON agent_safety_config
  FOR EACH ROW EXECUTE FUNCTION touch_safety_config_updated_at();

ALTER TABLE agent_safety_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_config_select ON agent_safety_config;
CREATE POLICY safety_config_select ON agent_safety_config FOR SELECT
  USING (company_id = current_user_company_id());

DROP POLICY IF EXISTS safety_config_update ON agent_safety_config;
CREATE POLICY safety_config_update ON agent_safety_config FOR UPDATE
  USING (company_id = current_user_company_id());

-- INSERT bloqueado pra usuarios; trigger ou service-role insere
-- DELETE bloqueado total

-- 2. Trigger: cria config default ao inserir company
CREATE OR REPLACE FUNCTION init_safety_config_for_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO agent_safety_config (company_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_init_safety_config ON companies;
CREATE TRIGGER trg_init_safety_config AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION init_safety_config_for_company();

-- 3. Backfill pra companies existentes
INSERT INTO agent_safety_config (company_id)
SELECT id FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================================
-- 4. Action Ledger (append-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_action_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  action_kind text NOT NULL,
  target_kind text NULL,
  target_external_id text NULL,
  payload_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_jsonb jsonb NULL,
  status text NOT NULL CHECK (status IN ('simulated', 'succeeded', 'failed', 'blocked', 'rolled_back')),
  block_reason text NULL CHECK (block_reason IS NULL OR block_reason IN (
    'rate_limit', 'circuit_breaker', 'spend_velocity', 'sandbox_mode', 'paused', 'requires_approval', 'config_disabled'
  )),
  latency_ms int NULL,
  cost_brl_estimate numeric(10, 2) NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('user', 'agent', 'cron', 'rule', 'plan')),
  triggered_by_id uuid NULL,
  rolled_back_from uuid NULL REFERENCES agent_action_ledger(id),
  idempotency_key text NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_idempotency ON agent_action_ledger(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_company_executed ON agent_action_ledger(company_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON agent_action_ledger(company_id, status, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_action_kind ON agent_action_ledger(company_id, action_kind, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_triggered ON agent_action_ledger(company_id, triggered_by, executed_at DESC);

ALTER TABLE agent_action_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_select ON agent_action_ledger;
CREATE POLICY ledger_select ON agent_action_ledger FOR SELECT
  USING (company_id = current_user_company_id());

-- INSERT/UPDATE/DELETE bloqueados pra usuarios; service-role bypass RLS

-- ============================================================================
-- 5. RPCs
-- ============================================================================

-- check_safety_gates: chamado por Edge Fn antes de executar acao externa
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
BEGIN
  SELECT * INTO v_config FROM agent_safety_config WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    INSERT INTO agent_safety_config (company_id) VALUES (p_company_id)
      ON CONFLICT (company_id) DO NOTHING;
    SELECT * INTO v_config FROM agent_safety_config WHERE company_id = p_company_id;
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

  -- 2. rate limit (1h)
  SELECT COUNT(*) INTO v_actions_1h FROM agent_action_ledger
    WHERE company_id = p_company_id
    AND status IN ('succeeded', 'simulated')
    AND executed_at > now() - interval '1 hour';
  IF v_actions_1h >= v_config.max_actions_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'block_reason', 'rate_limit',
      'limit', v_config.max_actions_per_hour,
      'window', '1h',
      'used', v_actions_1h
    );
  END IF;

  -- 3. rate limit (24h)
  SELECT COUNT(*) INTO v_actions_24h FROM agent_action_ledger
    WHERE company_id = p_company_id
    AND status IN ('succeeded', 'simulated')
    AND executed_at > now() - interval '24 hours';
  IF v_actions_24h >= v_config.max_actions_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'block_reason', 'rate_limit',
      'limit', v_config.max_actions_per_day,
      'window', '24h',
      'used', v_actions_24h
    );
  END IF;

  -- 4. spend velocity (somente em acoes que aumentam gasto)
  IF p_cost_brl_estimate IS NOT NULL AND p_cost_brl_estimate > 0
     AND p_action_kind IN ('update_budget_up', 'publish_campaign', 'create_campaign') THEN
    SELECT COALESCE(SUM(cost_brl_estimate), 0) INTO v_spend_24h
      FROM agent_action_ledger
      WHERE company_id = p_company_id
      AND status IN ('succeeded', 'simulated')
      AND action_kind IN ('update_budget_up', 'publish_campaign', 'create_campaign')
      AND executed_at > now() - interval '24 hours';
    IF (v_spend_24h + p_cost_brl_estimate) > (v_config.max_spend_increase_pct_per_day * 100) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'block_reason', 'spend_velocity',
        'cumulative_24h', v_spend_24h,
        'requested', p_cost_brl_estimate,
        'limit_brl', v_config.max_spend_increase_pct_per_day * 100
      );
    END IF;
  END IF;

  -- 5. requires_approval threshold
  IF p_cost_brl_estimate IS NOT NULL AND p_cost_brl_estimate > v_config.require_approval_above_brl THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'block_reason', 'requires_approval',
      'threshold', v_config.require_approval_above_brl,
      'cost', p_cost_brl_estimate
    );
  END IF;

  -- 6. permitido (com sinal de sandbox)
  RETURN jsonb_build_object(
    'allowed', true,
    'sandbox', v_config.sandbox_mode,
    'auto_execute', v_config.auto_execute_enabled,
    'remaining_quota', jsonb_build_object(
      'hour', v_config.max_actions_per_hour - v_actions_1h,
      'day', v_config.max_actions_per_day - v_actions_24h
    )
  );
END $$;

COMMENT ON FUNCTION check_safety_gates IS 'Pre-execution safety check. Returns {allowed, block_reason?, sandbox?, ...}';

-- log_agent_action: append-only log de execucao
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
  p_idempotency_key text DEFAULT NULL,
  p_rolled_back_from uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO agent_action_ledger (
    company_id, agent_name, action_kind, status, payload_jsonb, result_jsonb, block_reason,
    target_kind, target_external_id, latency_ms, cost_brl_estimate, triggered_by, triggered_by_id,
    idempotency_key, rolled_back_from
  ) VALUES (
    p_company_id, p_agent_name, p_action_kind, p_status, p_payload, p_result, p_block_reason,
    p_target_kind, p_target_external_id, p_latency_ms, p_cost_brl_estimate, p_triggered_by, p_triggered_by_id,
    p_idempotency_key, p_rolled_back_from
  )
  ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET
      status = EXCLUDED.status,
      result_jsonb = EXCLUDED.result_jsonb,
      latency_ms = EXCLUDED.latency_ms
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

COMMENT ON FUNCTION log_agent_action IS 'Append-only ledger insert. Idempotent via (company_id, idempotency_key).';

-- ============================================================================
-- 6. Trigger circuit breaker
-- ============================================================================

CREATE OR REPLACE FUNCTION check_circuit_breaker_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_threshold int;
  v_recent_failures int;
  v_cooldown int;
  v_currently_paused boolean;
BEGIN
  IF NEW.status <> 'failed' THEN
    RETURN NEW;
  END IF;

  SELECT
    circuit_breaker_threshold,
    circuit_breaker_cooldown_minutes,
    (paused_until IS NOT NULL AND paused_until > now())
  INTO v_threshold, v_cooldown, v_currently_paused
  FROM agent_safety_config WHERE company_id = NEW.company_id;

  IF v_threshold IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_currently_paused THEN
    RETURN NEW;
  END IF;

  -- conta failures nas ultimas N execucoes nao-blocked
  SELECT COUNT(*) INTO v_recent_failures FROM (
    SELECT status FROM agent_action_ledger
      WHERE company_id = NEW.company_id
      AND status IN ('succeeded', 'failed', 'simulated')
      ORDER BY executed_at DESC
      LIMIT v_threshold
  ) sub WHERE status = 'failed';

  IF v_recent_failures >= v_threshold THEN
    UPDATE agent_safety_config
      SET paused_until = now() + (v_cooldown || ' minutes')::interval,
          paused_reason = 'circuit_breaker: ' || NEW.agent_name || ' (' || v_threshold || ' failures consecutivas)'
      WHERE company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_circuit_breaker ON agent_action_ledger;
CREATE TRIGGER trg_circuit_breaker AFTER INSERT ON agent_action_ledger
  FOR EACH ROW EXECUTE FUNCTION check_circuit_breaker_after_insert();

-- ============================================================================
-- 7. RPC observability
-- ============================================================================

CREATE OR REPLACE FUNCTION get_safety_status(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
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
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_company');
  END IF;

  SELECT * INTO v_config FROM agent_safety_config WHERE company_id = v_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_config_found', 'company_id', v_company_id);
  END IF;

  SELECT COUNT(*) INTO v_actions_1h FROM agent_action_ledger
    WHERE company_id = v_company_id AND executed_at > now() - interval '1 hour';
  SELECT COUNT(*) INTO v_actions_24h FROM agent_action_ledger
    WHERE company_id = v_company_id AND executed_at > now() - interval '24 hours';
  SELECT COALESCE(SUM(cost_brl_estimate), 0) INTO v_spend_24h FROM agent_action_ledger
    WHERE company_id = v_company_id
    AND status IN ('succeeded', 'simulated')
    AND action_kind IN ('update_budget_up', 'publish_campaign', 'create_campaign')
    AND executed_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_failures FROM (
    SELECT status FROM agent_action_ledger
      WHERE company_id = v_company_id
      AND status IN ('succeeded', 'failed', 'simulated')
      ORDER BY executed_at DESC
      LIMIT v_config.circuit_breaker_threshold
  ) sub WHERE status = 'failed';
  SELECT jsonb_object_agg(block_reason, c) INTO v_top_blocks FROM (
    SELECT block_reason, COUNT(*) as c FROM agent_action_ledger
      WHERE company_id = v_company_id
      AND status = 'blocked' AND block_reason IS NOT NULL
      AND executed_at > now() - interval '7 days'
      GROUP BY block_reason
  ) sub;

  RETURN jsonb_build_object(
    'config', row_to_json(v_config),
    'actions_last_1h', v_actions_1h,
    'actions_last_24h', v_actions_24h,
    'cumulative_spend_24h', v_spend_24h,
    'consecutive_failures', v_failures,
    'is_paused', v_config.paused_until IS NOT NULL AND v_config.paused_until > now(),
    'paused_until', v_config.paused_until,
    'paused_reason', v_config.paused_reason,
    'top_block_reasons_7d', COALESCE(v_top_blocks, '{}'::jsonb)
  );
END $$;

COMMENT ON FUNCTION get_safety_status IS 'Snapshot de seguranca pra UI. Inclui config + counters + breaker state.';

-- ============================================================================
-- 8. Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_safety_gates(uuid, text, text, numeric) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION log_agent_action(uuid, text, text, text, jsonb, jsonb, text, text, text, int, numeric, text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_safety_status(uuid) TO authenticated;
