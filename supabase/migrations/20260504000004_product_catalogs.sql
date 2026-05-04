-- catalog-management (Sprint 6/8)
-- Espelha catalogs Meta Business + product_sets pra DPA.
-- MVP read-only — produtos individuais nao replicados localmente.

CREATE TABLE IF NOT EXISTS product_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  business_id text,
  product_count int,
  vertical text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_catalogs_unique UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_product_catalogs_company ON product_catalogs(company_id);

ALTER TABLE product_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_catalogs_select ON product_catalogs;
CREATE POLICY product_catalogs_select ON product_catalogs FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
      SELECT current_organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS product_catalogs_modify ON product_catalogs;
CREATE POLICY product_catalogs_modify ON product_catalogs FOR ALL
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

-- ============================================================================

CREATE TABLE IF NOT EXISTS product_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES product_catalogs(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  filter jsonb,
  product_count int,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_sets_unique UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_product_sets_catalog ON product_sets(catalog_id);
CREATE INDEX IF NOT EXISTS idx_product_sets_company ON product_sets(company_id);

ALTER TABLE product_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_sets_select ON product_sets;
CREATE POLICY product_sets_select ON product_sets FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
      SELECT current_organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS product_sets_modify ON product_sets;
CREATE POLICY product_sets_modify ON product_sets FOR ALL
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

COMMENT ON TABLE product_catalogs IS
  'Cache local de catalogs Meta Business. MVP read-only — produtos individuais ficam no Meta. Atualizado por meta-sync-catalogs.';
COMMENT ON TABLE product_sets IS
  'Subsets de produtos dentro de um catalog (filtro). Usados em campanhas DPA.';
