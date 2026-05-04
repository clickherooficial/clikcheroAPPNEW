-- pixel-engagement-audiences (Sprint 4/8)
-- Cache de pixels, pages, IG accounts, videos, lead forms (1h TTL).

CREATE TABLE IF NOT EXISTS meta_audience_sources_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pixel', 'page', 'ig_business', 'video', 'lead_form')),
  external_id text NOT NULL,
  name text NOT NULL,
  metadata jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_audience_sources_cache_unique UNIQUE (company_id, kind, external_id)
);

CREATE INDEX IF NOT EXISTS idx_audience_sources_company_kind
  ON meta_audience_sources_cache(company_id, kind);

COMMENT ON TABLE meta_audience_sources_cache IS
  'Cache de fontes de audiencia (pixels/pages/IG/videos/lead_forms) sincronizadas via Graph API. Atualizado por meta-list-audience-sources. TTL ~1h logico (UI usa fetched_at pra decidir refresh).';

ALTER TABLE meta_audience_sources_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audience_sources_select ON meta_audience_sources_cache;
CREATE POLICY audience_sources_select ON meta_audience_sources_cache
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE organization_id IN (
        SELECT current_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS audience_sources_modify ON meta_audience_sources_cache;
CREATE POLICY audience_sources_modify ON meta_audience_sources_cache
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
