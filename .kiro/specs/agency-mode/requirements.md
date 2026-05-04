# Requirements — agency-mode

> Sprint 8/8 (final). Fast-track. Escopo MVP — selector de ad_account, sem batch operations.

## Visao

Hoje `resolveMetaContext` pega `meta_ad_accounts` com LIMIT 1 — sempre o primeiro. Agencies/freelas conectam multi contas e precisam alternar. Esta sprint:
- Coluna `preferred_ad_account_external_id` em companies
- Selector global na UI (header)
- Tool pro chat saber qual conta esta ativa
- resolveMetaContext respeita preferencia

Out of scope: batch operations cross-account, agency cliente folder, billing por conta.

## Personas
- **Filipe (agency)** — gerencia 5 clientes, troca conta ativa pelo header
- **Pedro (loja unica)** — sem mudanca; selector aparece mas defaulta pra unica conta

## Requisitos

### R1 — Migration
`ALTER TABLE companies ADD COLUMN preferred_ad_account_external_id text` (nullable; null = primeira disponivel).

### R2 — Atualizar resolveMetaContext
Se `companies.preferred_ad_account_external_id` setado, usa ele. Senao, primeira de `meta_ad_accounts`.

### R3 — Tools
- `get_ad_accounts` — lista todas + indica preferida
- `set_preferred_ad_account` — muda preferencia da company

### R4 — UI
- `AdAccountSwitcher` — dropdown no header (ao lado do user menu)
- Lista accounts disponiveis, mostra atual em destaque, click muda preferencia + invalida queries de campanha

### R5 — Out of scope
- Cross-account batch operations
- Agency-level dashboard agregado (hub de N clientes)
- Tenant separation por agency (cada cliente tem seu company; ja resolvido)
