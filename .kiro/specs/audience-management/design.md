# Design — audience-management

> Sprint 3/8. Implementa o ciclo completo de Custom Audiences + Lookalikes.
> Reusa `_shared/meta-edits-helpers.ts` (Sprint 2) e `_shared/safety-rails.ts` (Sprint 1).

## Arquitetura

```
UI/chat -> tool -> Edge Fn (meta-audience-X)
  1. resolveMetaContext (Sprint 2 helper)
  2. Zod validate
  3. estimar cost_brl_estimate
  4. withSafetyRails(...)
  5. Meta Graph API call
  6. upsert local meta_audiences
  7. fireBackgroundSync se necessario
```

PII (email, telefone) **nunca** chega no servidor — hash SHA256 e feito no browser via WebCrypto antes do upload.

## Schema delta

### Migration: `20260504000001_audience_management.sql`

```sql
-- ==========================================================================
-- 1. Tabela meta_audiences
-- ==========================================================================

CREATE TABLE meta_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  description text,
  subtype text NOT NULL CHECK (subtype IN ('CUSTOM','LOOKALIKE','WEBSITE','APP','ENGAGEMENT')),
  parent_audience_id uuid REFERENCES meta_audiences(id) ON DELETE SET NULL,
  approximate_count_lower_bound bigint,
  approximate_count_upper_bound bigint,
  delivery_status jsonb,        -- { code: int, description: text }
  operation_status jsonb,
  retention_days int,
  lookalike_spec jsonb,         -- { country, ratio, type }
  rule jsonb,                   -- pixel rule (Sprint 4)
  time_created timestamptz,
  time_updated timestamptz,
  local_created_at timestamptz DEFAULT now(),
  local_updated_at timestamptz,
  UNIQUE (company_id, external_id)
);

CREATE INDEX idx_meta_audiences_company ON meta_audiences(company_id);
CREATE INDEX idx_meta_audiences_subtype ON meta_audiences(company_id, subtype);
CREATE INDEX idx_meta_audiences_parent ON meta_audiences(parent_audience_id) WHERE parent_audience_id IS NOT NULL;

ALTER TABLE meta_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_audiences_select ON meta_audiences FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE organization_id IN (
    SELECT current_organization_id FROM profiles WHERE id = auth.uid()
  )));

CREATE POLICY meta_audiences_modify ON meta_audiences FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE organization_id IN (
    SELECT current_organization_id FROM profiles WHERE id = auth.uid()
  )))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE organization_id IN (
    SELECT current_organization_id FROM profiles WHERE id = auth.uid()
  )));

-- ==========================================================================
-- 2. View meta_audience_usage
-- ==========================================================================

CREATE OR REPLACE VIEW meta_audience_usage AS
SELECT
  ma.id              AS audience_id,
  ma.company_id,
  ma.external_id     AS audience_external_id,
  ma.name            AS audience_name,
  ma.subtype,
  a.id               AS adset_id,
  a.external_id      AS adset_external_id,
  a.name             AS adset_name,
  a.status           AS adset_status,
  CASE
    WHEN a.targeting->'custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id)) THEN 'included'
    WHEN a.targeting->'excluded_custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id)) THEN 'excluded'
    ELSE NULL
  END AS usage_kind
FROM meta_audiences ma
JOIN adsets a
  ON a.company_id = ma.company_id
  AND (
    a.targeting->'custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
    OR a.targeting->'excluded_custom_audiences' @> jsonb_build_array(jsonb_build_object('id', ma.external_id))
  );

COMMENT ON VIEW meta_audience_usage IS
  'Cruza meta_audiences com adsets.targeting pra detectar quais audiencias estao em uso. Usada pra bloquear delete de audiencia em uso ATIVO.';

-- ==========================================================================
-- 3. RPC pra checar uso ativo
-- ==========================================================================

CREATE OR REPLACE FUNCTION audience_in_active_use(p_audience_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM meta_audience_usage
    WHERE audience_id = p_audience_id AND adset_status = 'ACTIVE'
  );
$$;

GRANT EXECUTE ON FUNCTION audience_in_active_use(uuid) TO authenticated;
```

## Edge Functions

### `_shared/audience-helpers.ts`

```typescript
export interface AudiencePayload {
  payload: { schema: string[]; data: string[][] }; // ja hashed SHA256
}

export async function uploadUsersInBatches(
  audienceExternalId: string,
  payload: AudiencePayload['payload'],
  token: string,
): Promise<{ batches: number; total_rows: number }> {
  const BATCH = 10000;
  let batches = 0;
  for (let i = 0; i < payload.data.length; i += BATCH) {
    const batchData = payload.data.slice(i, i + BATCH);
    await metaPatch(`${audienceExternalId}/users`, {
      payload: { schema: payload.schema, data: batchData },
    }, token);
    batches += 1;
    if (i + BATCH < payload.data.length) await new Promise((r) => setTimeout(r, 200));
  }
  return { batches, total_rows: payload.data.length };
}

export async function fetchAudiencePages(
  adAccountId: string,
  token: string,
): Promise<any[]> {
  const all: any[] = [];
  let url = `https://graph.facebook.com/v22.0/${adAccountId}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,time_created,time_updated,description,rule,retention_days,lookalike_spec&limit=100&access_token=${encodeURIComponent(token)}`;
  while (url) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok) throw new MetaApiError(j?.error?.message ?? 'list_failed', j?.error?.code);
    all.push(...(j.data ?? []));
    url = j.paging?.next ?? null;
    if (url) await new Promise((res) => setTimeout(res, 200));
  }
  return all;
}
```

### `meta-sync-audiences/index.ts`

Pseudo-codigo:
```typescript
serve(async (req) => {
  const ctx = await resolveMetaContext(req, supabaseAdmin);
  const remote = await fetchAudiencePages(ctx.adAccountId, ctx.metaToken);
  let upserted = 0;
  for (const a of remote) {
    await supabaseAdmin.from('meta_audiences').upsert({
      company_id: ctx.companyId,
      external_id: a.id,
      name: a.name,
      description: a.description,
      subtype: a.subtype ?? 'CUSTOM',
      approximate_count_lower_bound: a.approximate_count_lower_bound,
      approximate_count_upper_bound: a.approximate_count_upper_bound,
      delivery_status: a.delivery_status,
      operation_status: a.operation_status,
      retention_days: a.retention_days,
      lookalike_spec: a.lookalike_spec,
      rule: a.rule,
      time_created: a.time_created,
      time_updated: a.time_updated,
      local_updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,external_id' });
    upserted += 1;
  }
  return jsonResponse({ ok: true, synced: upserted });
});
```

### `meta-audience-create/index.ts`

```typescript
const PayloadSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(255).optional(),
  customer_file_source: z.enum(['USER_PROVIDED_ONLY','PARTNER_PROVIDED_ONLY','BOTH_USER_AND_PARTNER_PROVIDED']),
  payload: z.object({
    schema: z.array(z.enum(['EMAIL','PHONE','FN','LN','GEN','DOBY','COUNTRY'])),
    data: z.array(z.array(z.string().regex(/^[a-f0-9]{64}$/, 'must_be_sha256_hex'))),
  }),
  retention_days: z.number().int().min(1).max(540).default(180),
  triggered_by: z.enum(['user','agent','rule','plan']).default('user'),
});

// withSafetyRails wrap:
//   1. POST /act_{id}/customaudiences { name, subtype: 'CUSTOM', customer_file_source, retention_days }
//   2. uploadUsersInBatches(audienceExternalId, payload, token)
//   3. INSERT meta_audiences (company_id, external_id, name, subtype='CUSTOM', delivery_status='processing')
//   4. return { ok: true, audience_id, external_id, batches, rows }
```

### `meta-audience-lookalike/index.ts`

```typescript
const PayloadSchema = z.object({
  name: z.string().min(1).max(80),
  origin_audience_id: z.string().uuid().optional(),
  origin_audience_external_id: z.string().optional(),
  lookalike_spec: z.object({
    country: z.string().length(2),
    ratio: z.number().refine(r => [0.01, 0.02, 0.05, 0.10].includes(r), 'must_be_1_2_5_10_pct'),
    type: z.enum(['similarity','reach','reach_and_similarity']).default('similarity'),
  }),
  triggered_by: z.enum(['user','agent','rule','plan']).default('user'),
}).refine(d => d.origin_audience_id || d.origin_audience_external_id);

// 1. resolve origin (local lookup; valida count >= 100)
// 2. POST /act_{id}/customaudiences { name, subtype: 'LOOKALIKE', origin_audience_id, lookalike_spec }
// 3. INSERT meta_audiences (subtype='LOOKALIKE', parent_audience_id=local_origin_uuid, lookalike_spec)
```

### `meta-audience-update/index.ts`

Aceita `name?`, `description?`, `retention_days?`. Faz POST `/{external_id}`. Update local.

### `meta-audience-delete/index.ts`

```typescript
const PayloadSchema = z.object({
  audience_id: z.string().uuid(),
  confirm: z.boolean().default(false),
});

// 1. if (!confirm) return { ok: false, requires_confirmation: true, error: 'pass confirm=true to delete' };
// 2. const inUse = await rpc('audience_in_active_use', { p_audience_id: audience_id });
// 3. if (inUse) return { ok: false, in_active_use: true, error: 'detach from adsets first' };
// 4. withSafetyRails (action_kind='delete_audience', cost=0):
//      DELETE /{external_id}
//      DELETE FROM meta_audiences WHERE id = audience_id
```

## Tools no chat

```typescript
// _shared/tools.ts (CHAT_TOOLS)
{
  name: 'create_customer_list_audience',
  description: 'Cria uma Custom Audience no Meta Ads a partir de uma lista de clientes (CSV). USE quando o usuario pedir "audiencia de quem ja comprou", "remarketing de leads", etc. PII (email/telefone) deve estar SHA256 ja antes de chamar — o frontend faz isso.',
  parameters: { /* schema espelha PayloadSchema acima */ },
},
{
  name: 'create_lookalike_audience',
  description: 'Cria uma Lookalike Audience (semelhantes) baseada em uma audiencia existente. Origem precisa ter >=100 pessoas. Use quando o usuario pedir "publico parecido com X" ou "expandir base".',
  parameters: { /* ... */ },
},
{
  name: 'update_audience',
  description: 'Atualiza nome/descricao/retention_days de uma audiencia existente. NAO usa pra adicionar/remover usuarios — pra isso usar create_customer_list_audience com a lista nova.',
  parameters: { /* ... */ },
},
{
  name: 'delete_audience',
  description: 'Deleta uma audiencia. Recusa se em uso ATIVO em algum adset; recusa sem confirm=true. Use APENAS quando o usuario explicitamente pedir pra deletar.',
  parameters: { /* ... */ },
},
```

## Frontend

### Tipos `src/types/audiences.ts`

```typescript
export type AudienceSubtype = 'CUSTOM' | 'LOOKALIKE' | 'WEBSITE' | 'APP' | 'ENGAGEMENT';

export interface MetaAudience {
  id: string;
  company_id: string;
  external_id: string;
  name: string;
  description: string | null;
  subtype: AudienceSubtype;
  parent_audience_id: string | null;
  approximate_count_lower_bound: number | null;
  approximate_count_upper_bound: number | null;
  delivery_status: { code?: number; description?: string } | null;
  retention_days: number | null;
  lookalike_spec: { country: string; ratio: number; type: string } | null;
  time_created: string | null;
  time_updated: string | null;
  local_updated_at: string | null;
}

export interface CreateCustomerListAudiencePayload {
  name: string;
  description?: string;
  customer_file_source: 'USER_PROVIDED_ONLY' | 'PARTNER_PROVIDED_ONLY' | 'BOTH_USER_AND_PARTNER_PROVIDED';
  payload: { schema: string[]; data: string[][] };
  retention_days?: number;
}

export interface CreateLookalikePayload {
  name: string;
  origin_audience_id?: string;
  origin_audience_external_id?: string;
  lookalike_spec: { country: string; ratio: 0.01 | 0.02 | 0.05 | 0.10; type?: 'similarity'|'reach'|'reach_and_similarity' };
}
```

### Hook `src/hooks/use-audiences.ts`

```typescript
export function useAudiences() {
  return useQuery({
    queryKey: ['audiences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meta_audiences').select('*').order('local_updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSyncAudiences() { /* mutation -> meta-sync-audiences */ }
export function useCreateCustomerListAudience() { /* hash client-side antes; mutation -> meta-audience-create */ }
export function useCreateLookalike() { /* mutation -> meta-audience-lookalike */ }
export function useUpdateAudience() { /* mutation -> meta-audience-update */ }
export function useDeleteAudience() { /* mutation -> meta-audience-delete */ }
```

### Hash SHA256 client-side

`src/lib/sha256.ts`:
```typescript
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashRow(schema: string[], rawRow: string[]): Promise<string[]> {
  // Meta normaliza: emails/telefones lowercase trimmed
  return Promise.all(rawRow.map((v) => sha256Hex(v)));
}
```

### Componentes

- `src/components/audiences/AudienceListRow.tsx` — row de tabela com nome, subtype, count, status, retention
- `src/components/audiences/CreateAudienceDialog.tsx` — 3 tabs: Custom (CSV upload), Pixel (Sprint 4 — placeholder), Lookalike
- `src/components/audiences/CSVDropzone.tsx` — drag-and-drop com preview 5 linhas + parser
- `src/components/audiences/LookalikePicker.tsx` — combo de origem + slider de ratio + select de country
- `src/components/audiences/DeleteAudienceConfirm.tsx` — alert dialog com checagem de uso
- `src/components/AudiencesView.tsx` — composer (lista + botoes top + dialog)

### Sidebar

- Item "Audiências" (icone `Users`) em secondaryItems no [AppSidebar.tsx](src/components/AppSidebar.tsx)

## Decisoes

### Por que hash SHA256 client-side e nao server?
Compliance + risco. Se hashearmos no servidor, server toca PII em texto claro (mesmo que efemero) — auditoria fica mais cara. Browser hashing usa WebCrypto API (nativo, rapido, sem libs). Server so recebe lista de hashes hex — nao tem como reverter. Custo: cliente precisa de browser moderno (todos suportam).

### Por que parent_audience_id em meta_audiences (auto-fk)?
Lookalikes precisam saber quem e a "fonte". Permite UI: "esta LAL veio da audiencia X — atualizar fonte tambem atualiza esta?". Nao implementamos auto-update agora, mas o link existe pra Sprint 5.

### Por que retention_days default 180?
Maximo Meta = 540 dias. 180 e o sweet spot — cobre maioria dos use cases (6 meses) sem desperdicar verba indexando gente que nao volta.

### Por que view `meta_audience_usage` em vez de tabela junction?
Targeting do adset ja vive em `adsets.targeting jsonb`. Criar tabela junction seria duplicar. View extrai junction-on-demand, sempre fresh. Custo: query mais cara (jsonb @> em N adsets) — mas N e pequeno (centenas) e a view e usada so pra delete check.

### Por que delete pede confirm=true E nao em uso ativo?
Defesa em camadas. `confirm=true` protege de chamada acidental por LLM/tool sem aprovacao explicita do usuario. `in_active_use` protege contra quebrar adset rodando (audiencia some -> Meta retorna erro de targeting -> adset entra em learning de novo -> custo). Pra deletar audiencia em uso, primeiro detacha do adset.

### Por que NAO criar Pixel/Engagement audience nesta sprint?
Pixel exige rule builder UI complexo (eventos, time windows, parametros). Engagement audience tem 8 tipos diferentes (page, video, IG, etc). Sprint 4 cobre.
