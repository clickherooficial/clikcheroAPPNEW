# Design — catalog-management (resumido)

## Schema

```sql
CREATE TABLE product_catalogs (
  id uuid PK DEFAULT gen_random_uuid(),
  company_id uuid FK,
  external_id text NOT NULL,
  name text NOT NULL,
  business_id text,
  product_count int,
  vertical text,
  fetched_at timestamptz,
  UNIQUE (company_id, external_id)
);

CREATE TABLE product_sets (
  id uuid PK,
  company_id uuid FK,
  catalog_id uuid FK product_catalogs ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  filter jsonb,
  product_count int,
  fetched_at timestamptz,
  UNIQUE (company_id, external_id)
);
```

RLS scoped por current_organization_id (mesmo padrao).

## Edge Fn `meta-sync-catalogs`

```
1. resolveMetaContext (Sprint 2 helper)
2. GET /me/businesses?fields=id,name (pega business_id do user)
3. Para cada business: GET /{biz_id}/owned_product_catalogs?fields=id,name,product_count,vertical
4. Para cada catalog: GET /{catalog_id}/product_sets?fields=id,name,filter,product_count
5. Upsert tudo em product_catalogs + product_sets
```

## Tool `list_catalogs`

Retorna texto formatado:
```
Catalogs disponiveis:
1. "Roupas Inverno" (catalog_id=abc123) - 240 produtos
   Sets: "Casacos" (45), "Botas" (30)
2. "Loja Online" (catalog_id=def456) - 1200 produtos
```

## UI

- `src/types/catalogs.ts` — tipos
- `src/hooks/use-catalogs.ts` — query + mutation sync
- `src/components/CatalogsView.tsx` — lista + expand sets + sync

## Decisoes
- **Read-only nesta sprint** — escrita exige feeds externos (XML/CSV), fora de escopo
- **Cache via fetched_at** — UI mostra "Sincronizado ha X min"
- **NAO incluir produtos individuais** — sao milhares; UI fica pesada e nao agrega valor pro agente AI
