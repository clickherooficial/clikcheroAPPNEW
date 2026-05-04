# Design — ab-testing (resumido)

## Schema

```sql
CREATE TABLE ab_tests (
  id uuid PK,
  company_id uuid FK,
  name text NOT NULL,
  variant_a_kind text CHECK (in ('campaign','adset','ad')),
  variant_a_external_id text NOT NULL,
  variant_a_local_id uuid,
  variant_a_label text,
  variant_b_kind text CHECK (in ('campaign','adset','ad')),
  variant_b_external_id text NOT NULL,
  variant_b_local_id uuid,
  variant_b_label text,
  criterion text NOT NULL CHECK (in ('ctr','cpl','roas','conversions','spend_efficiency')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  winner_variant text CHECK (in ('a','b','tied','inconclusive')),
  evaluation_summary jsonb,
  notes text,
  created_at timestamptz default now(),
  UNIQUE(company_id, variant_a_external_id, variant_b_external_id)
);
```

RLS scoped por current_organization_id.

## Edge Fn `ab-test-evaluate`

```typescript
1. Load test row, validar company_id
2. Pra cada variant: loadMetrics(kind, external_id, since=test.started_at)
3. Decisao por criterion:
   - ctr: clicks / impressions
   - cpl: spend / leads
   - roas: revenue / spend
   - conversions: total
   - spend_efficiency: conversions / spend
4. Sample size check (cliques>=100 pra CTR, conversoes>=30 pra CPL/ROAS)
5. Diferenca relativa: (best - worst) / worst
6. Decisao:
   - sample insuficiente -> 'inconclusive'
   - diff < 10% -> 'tied'
   - diff >= 10% -> declarar 'a' ou 'b' como vencedor
7. Update ab_tests: winner_variant, evaluation_summary jsonb com numbers
```

## Tools

```typescript
start_ab_test: { name, variant_a_external_id, variant_a_kind, variant_b_external_id, variant_b_kind, criterion }
get_ab_tests: {}
evaluate_ab_test: { test_id }
```

## Frontend

- `src/types/ab-tests.ts`
- `src/hooks/use-ab-tests.ts`
- `src/components/ab-testing/ABTestCard.tsx` — side-by-side com 2 colunas mostrando metricas
- `src/components/ABTestsView.tsx` — lista active/ended

## Decisoes
- **Threshold 10% diff + amostra minima** — heuristica, nao Bayesian rigoroso. Honesto: alerta sem prometer p-value rigoroso.
- **Cross-kind tests permitidos** (campaign vs adset) — raro mas o usuario pode querer comparar A campanha inteira com B adset isolado.
- **Avaliacao manual on-demand** — sem cron auto-evaluate (pode adicionar depois)
