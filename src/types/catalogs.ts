// catalog-management (Sprint 6/8) — tipos.

export interface ProductCatalog {
  id: string;
  company_id: string;
  external_id: string;
  name: string;
  business_id: string | null;
  product_count: number | null;
  vertical: string | null;
  fetched_at: string;
}

export interface ProductSet {
  id: string;
  company_id: string;
  catalog_id: string;
  external_id: string;
  name: string;
  filter: Record<string, unknown> | null;
  product_count: number | null;
  fetched_at: string;
}
