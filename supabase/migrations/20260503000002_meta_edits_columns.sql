-- meta-edits-suite (Sprint 2/8)
-- Adiciona local_updated_at em campaigns/adsets pra detectar drift entre nossa edicao e meta-sync.
-- View v_editable_campaigns pra UI listar campanhas editaveis.
-- RPC estimate_budget_change_impact pra UI mostrar preview de impacto antes de submit.

-- ============================================================================
-- 1. Colunas local_updated_at + edit-relevant columns em campaigns
-- ============================================================================

-- campaigns historicamente so tinha 'budget' (texto generico). Adicionar campos especificos
-- pra suportar update_campaign (Sprint 2).
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS lifetime_budget numeric,
  ADD COLUMN IF NOT EXISTS bid_strategy text,
  ADD COLUMN IF NOT EXISTS bid_amount numeric,
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS stop_time timestamptz,
  ADD COLUMN IF NOT EXISTS local_updated_at timestamptz;

ALTER TABLE adsets
  ADD COLUMN IF NOT EXISTS local_updated_at timestamptz;

COMMENT ON COLUMN campaigns.local_updated_at IS
  'Timestamp da ultima edicao via meta-edits-suite (NAO confunde com updated_at que tambem e atualizado por meta-sync). Se local_updated_at < updated_at, sync sobrescreveu nossa edicao.';

COMMENT ON COLUMN adsets.local_updated_at IS
  'Timestamp da ultima edicao via meta-edits-suite. Ver campaigns.local_updated_at.';

-- ============================================================================
-- 2. View v_editable_campaigns
-- ============================================================================

CREATE OR REPLACE VIEW v_editable_campaigns AS
SELECT
  c.id,
  c.company_id,
  c.external_id,
  c.name,
  c.status,
  c.objective,
  c.daily_budget,
  c.lifetime_budget,
  c.bid_strategy,
  c.start_time,
  c.stop_time,
  c.local_updated_at,
  c.updated_at,
  (SELECT COUNT(*)::int FROM adsets a WHERE a.campaign_id = c.id) AS adset_count
FROM campaigns c
WHERE c.status NOT IN ('DELETED', 'ARCHIVED');

COMMENT ON VIEW v_editable_campaigns IS
  'Campanhas editaveis (excluindo deletadas/arquivadas) com contagem de adsets. Usada pela OptimizationView no frontend.';

-- ============================================================================
-- 3. RPC estimate_budget_change_impact
-- ============================================================================

CREATE OR REPLACE FUNCTION estimate_budget_change_impact(
  p_campaign_id uuid,
  p_new_daily_budget numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current numeric;
  v_company_id uuid;
  v_diff numeric;
  v_30d_projection numeric;
BEGIN
  SELECT company_id, daily_budget
    INTO v_company_id, v_current
    FROM campaigns
    WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_diff := p_new_daily_budget - COALESCE(v_current, 0);
  v_30d_projection := p_new_daily_budget * 30;

  RETURN jsonb_build_object(
    'current_daily', v_current,
    'new_daily', p_new_daily_budget,
    'delta_brl', v_diff,
    'delta_pct', CASE WHEN v_current > 0 THEN ROUND((v_diff / v_current) * 100, 2) ELSE NULL END,
    'projection_30d_brl', v_30d_projection
  );
END;
$$;

GRANT EXECUTE ON FUNCTION estimate_budget_change_impact(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION estimate_budget_change_impact IS
  'Calcula delta absoluto/percentual e projecao 30d ao mudar daily_budget. SECURITY INVOKER => respeita RLS de campaigns. Retorna jsonb {current_daily, new_daily, delta_brl, delta_pct, projection_30d_brl} ou {error}.';
