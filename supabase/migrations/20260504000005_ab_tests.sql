-- ab-testing (Sprint 7/8)
-- Track A/B tests entre 2 variantes (campaign/adset/ad). Avaliacao on-demand.

CREATE TABLE IF NOT EXISTS ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,

  variant_a_kind text NOT NULL CHECK (variant_a_kind IN ('campaign', 'adset', 'ad')),
  variant_a_external_id text NOT NULL,
  variant_a_local_id uuid,
  variant_a_label text,

  variant_b_kind text NOT NULL CHECK (variant_b_kind IN ('campaign', 'adset', 'ad')),
  variant_b_external_id text NOT NULL,
  variant_b_local_id uuid,
  variant_b_label text,

  criterion text NOT NULL CHECK (criterion IN ('ctr', 'cpl', 'roas', 'conversions', 'spend_efficiency')),

  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  evaluated_at timestamptz,
  winner_variant text CHECK (winner_variant IN ('a', 'b', 'tied', 'inconclusive')),
  evaluation_summary jsonb,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ab_tests_unique UNIQUE (company_id, variant_a_external_id, variant_b_external_id)
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_company ON ab_tests(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_tests_active ON ab_tests(company_id) WHERE ended_at IS NULL;

ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ab_tests_select ON ab_tests;
CREATE POLICY ab_tests_select ON ab_tests FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
      SELECT current_organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS ab_tests_modify ON ab_tests;
CREATE POLICY ab_tests_modify ON ab_tests FOR ALL
  USING (company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
      SELECT current_organization_id FROM profiles WHERE id = auth.uid()
    )
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
      SELECT current_organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

COMMENT ON TABLE ab_tests IS
  'A/B tests entre 2 variantes Meta (campaign/adset/ad). Avaliacao on-demand via Edge Fn ab-test-evaluate. Threshold heuristico 10% diff + amostra minima — nao Bayesian rigoroso.';
