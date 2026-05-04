# Requirements — ab-testing

> Sprint 7/8. Fast-track. Escopo MVP — track + evaluate, sem auto-duplicate.

## Visao

A/B testing manual: usuario cria 2 campanhas/adsets variantes (via Sprint 2 tools), inicia um "teste"
linkando elas, e quando achar adequado pede pra avaliar — sistema declara vencedor com base
em metric escolhida (CTR, CPL, ROAS) com Bayesian rough threshold.

## Personas
- **Pedro** — "estou rodando 2 versoes do mesmo anuncio, qual ta ganhando?"
- **Filipe** — quer registrar formalmente o teste pra historico
- **Agente IA** — propoe via FURY: "depois de 7d, encerrar teste e pausar perdedor"

## Requisitos

### R1 — Migration ab_tests
```
ab_tests (
  id uuid pk, company_id uuid fk,
  name text not null,
  variant_a_kind text check (in ('campaign','adset','ad')),
  variant_a_external_id text not null,
  variant_a_local_id uuid,
  variant_b_kind text,
  variant_b_external_id text not null,
  variant_b_local_id uuid,
  criterion text check (in ('ctr','cpl','roas','conversions','spend_efficiency')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  winner_variant text check (in ('a','b','tied','inconclusive')),
  evaluation_summary jsonb,
  created_by uuid,
  notes text
)
```

### R2 — Edge Fn `ab-test-evaluate`
Aceita `{ test_id }`. Le metricas das 2 variantes (campaign_metrics ou adset_metrics ou metricas no nivel ad), calcula rates, decide vencedor:
- CTR/CPL/ROAS: razao entre variantes — se > 20% diferenca + amostra >100 conversoes (ou cliques pra CTR), declara vencedor
- Senao 'tied' ou 'inconclusive'

### R3 — Tools no chat
- `start_ab_test` — cria ab_tests row
- `get_ab_tests` — lista testes ativos + summary
- `evaluate_ab_test` — invoca Edge Fn

### R4 — UI ABTestsView
Lista testes (Em andamento / Encerrados), card com side-by-side de metricas das 2 variantes, botao "Avaliar agora".

### R5 — Out of scope
- Duplicate campaign automatico (usuario cria manualmente via update_campaign + new name)
- Bayesian rigoroso / multivariate — aproximacao razao + amostra minima ja serve pra alertar
- Auto-pause perdedor (FURY rule pode fazer)
