-- audience-management (Sprint 3/8)
-- Tabela meta_audiences (Custom + Lookalike), view de uso, RPC pra checar uso ativo, RLS.

-- ============================================================================
-- 1. Tabela meta_audiences
-- ============================================================================

CREATE TABLE IF NOT EXISTS meta_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  description text,
  subtype text NOT NULL CHECK (subtype IN ('CUSTOM','LOOKALIKE','WEBSITE','APP','ENGAGEMENT')),
  parent_audience_id uuid REFERENCES meta_audiences(id) ON DELETE SET NULL,
  approximate_count_lower_bound bigint,
  approximate_count_upper_bound bigint,
  delivery_status jsonb,
  operation_status jsonb,
  retention_days int,
  lookalike_spec jsonb,
  rule jsonb,
  time_created timestamptz,
  time_updated timestamptz,
  local_created_at timestamptz NOT NULL DEFAULT now(),
  local_updated_at timestamptz,
  CONSTRAINT meta_audiences_company_external_unique UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_audiences_company ON meta_audiences(company_id);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_subtype ON meta_audiences(company_id, subtype);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_parent ON meta_audiences(parent_audience_id) WHERE parent_audience_id IS NOT NULL;

COMMENT ON TABLE meta_audiences IS
  'Custom Audiences e Lookalikes do Meta Ads sincronizados localmente. PII (email/telefone) NUNCA reside aqui — hash SHA256 e feito client-side antes de upload. Esta tabela e somente metadata.';

COMMENT ON COLUMN meta_audiences.parent_audience_id IS
  'Self-FK pra LAL apontar pra audiencia origem. ON DELETE SET NULL pra nao bloquear delete da origem.';

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

ALTER TABLE meta_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_audiences_select ON meta_audiences;
CREATE POLICY meta_audiences_select ON meta_audiences
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE organization_id IN (
        SELECT current_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS meta_audiences_modify ON meta_audiences;
CREATE POLICY meta_audiences_modify ON meta_audiences
  FOR ALL
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE organization_id IN (
        SELECT current_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE organization_id IN (
        SELECT current_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 3. View meta_audience_usage
-- ============================================================================

CREATE OR REPLACE VIEW meta_audience_usage AS
SELECT
  ma.id              AS audience_id,
  ma.company_id,
  ma.external_id     AS audience_external_id,
  ma.name            AS audience_name,
  ma.subtype,
  a.id               AS adset_id,
  a.external_id      AS adset_external_id,
  a.name             AS adset_name,
  a.status           AS adset_status,
  CASE
    WHEN a.targeting->'custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
      THEN 'included'
    WHEN a.targeting->'excluded_custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
      THEN 'excluded'
    ELSE NULL
  END AS usage_kind
FROM meta_audiences ma
JOIN adsets a
  ON a.company_id = ma.company_id
  AND (
    a.targeting ? 'custom_audiences'
    OR a.targeting ? 'excluded_custom_audiences'
  )
  AND (
    a.targeting->'custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
    OR a.targeting->'excluded_custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
  );

COMMENT ON VIEW meta_audience_usage IS
  'Cruza meta_audiences com adsets.targeting pra detectar uso. Cada row = par (audiencia, adset). Usada pra bloquear delete de audiencia em uso ativo.';

-- ============================================================================
-- 4. RPC audience_in_active_use
-- ============================================================================

CREATE OR REPLACE FUNCTION audience_in_active_use(p_audience_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meta_audience_usage
    WHERE audience_id = p_audience_id
      AND adset_status = 'ACTIVE'
  );
$$;

GRANT EXECUTE ON FUNCTION audience_in_active_use(uuid) TO authenticated;

COMMENT ON FUNCTION audience_in_active_use IS
  'Retorna true se audiencia esta referenciada por algum adset ACTIVE. Usada pelo meta-audience-delete pra bloquear delete sem detach previo.';
