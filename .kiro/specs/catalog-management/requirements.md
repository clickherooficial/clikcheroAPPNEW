# Requirements — catalog-management

> Sprint 6/8. Fast-track overnight. Escopo MVP read-only — produto detalhe e CRUD ficam pra v2.

## Visao

Para ecommerce, **Product Catalog** e a base de DPA (Dynamic Product Ads). Esta sprint entrega:
- Listar e sincronizar catalogs do Meta Business
- Listar product_sets de cada catalog
- Tool no chat pro agente referenciar catalog/set (ex: "criar campanha DPA do catalogo Roupas Inverno")
- View no painel pra ver catalogs disponiveis

Out of scope (v2):
- CRUD de produtos individuais (geralmente vem de feed XML/CSV externo, nao queremos duplicar)
- Criar catalog do zero (raro — usuario cria via Commerce Manager Meta)
- Conectar feed automatico (proxima sprint)
- Criar campanha DPA com catalog_id (vai depender de extensao em campaign-publish)

## Personas
- **Pedro** — "minha loja tem 200 produtos, quero anuncio dinamico"
- **Filipe** — quer ver quais catalogs estao conectados ao Business antes de planejar campanha
- **Agente IA** — pergunta "qual catalog usar pra DPA?" antes de propor campanha

## Requisitos

### R1 — Migration: tabelas locais
- `product_catalogs` — espelha catalogs do Meta Business
- `product_sets` — subsets dentro de cada catalog (filtros, ex: "Roupas Inverno")

### R2 — Edge `meta-sync-catalogs`
Pagina /me/businesses/{biz_id}/owned_product_catalogs e /{catalog_id}/product_sets.
Upserta local. Pode ser invocado via cron diario ou botao manual.

### R3 — Tool `list_catalogs`
Retorna catalogs + sets do company atual. Agente pode usar pra montar resposta.

### R4 — UI: CatalogsView
- Lista catalogs com nome, product_count
- Expand mostra product_sets
- Botao "Sincronizar"

### R5 — Out of scope
- Criar catalog/set
- Editar produto individual
- Criar campanha DPA (depende de catalog_id no payload — extensao futura de campaign-publish)
