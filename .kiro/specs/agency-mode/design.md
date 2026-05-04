# Design — agency-mode (resumido)

## Schema
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS preferred_ad_account_external_id text;
```

## Edge resolveMetaContext patch
Se preferred_ad_account_external_id existe, busca em meta_ad_accounts WHERE external_id=preferred. Senao, fallback LIMIT 1 atual.

## Tools
- `get_ad_accounts` (read-only): retorna texto formatado com lista + preferida
- `set_preferred_ad_account` (write): UPDATE companies SET preferred_ad_account_external_id

## Frontend
- `src/hooks/use-ad-accounts.ts` — query meta_ad_accounts + companies.preferred + mutations
- `src/components/auth/AdAccountSwitcher.tsx` — DropdownMenu no header

## Decisoes
- **String column em vez de FK** — meta_ad_accounts sync pode rotacionar; nao queremos cascade
- **Fallback gracioso** — preferida some, volta pra primeira; nao quebra
