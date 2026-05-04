// apply-creative-pipeline — aplica creative_pipeline_rules ativas em uma imagem.
// Spec: .kiro/specs/fury-learning/ (T2.3)
//
// Input:  { creative_id: uuid, source_storage_path: string, source_bucket?: string }
// Output: { transformed_storage_path: string, applied_rule_ids: string[], skipped?: boolean }
//
// Pipeline:
//   1. Tenant guard (JWT -> companyId)
//   2. Buscar creative + validar mesma company
//   3. Buscar creative_pipeline_rules ativas (priority asc)
//   4. Baixar imagem original (bucket configuravel — default 'creatives')
//   5. Para cada regra: matchesScope -> applyTransform; coletar applied_ids
//   6. Encodar PNG, upload em path final
//   7. UPDATE creatives.media_url + pipeline_applied_rules + pipeline_source_path
//   8. UPDATE rules.last_applied_at em batch

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireTenant } from '../_shared/tenant-guard.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

interface PipelineRule {
  id: string;
  transform_type: string;
  transform_params: Record<string, unknown>;
  applies_to: { media_types?: string[]; scope?: { level?: string; id?: string } };
  priority: number;
}

function matchesScope(applies_to: PipelineRule['applies_to'], creative: Record<string, unknown>): boolean {
  const mediaTypes = applies_to?.media_types ?? ['image'];
  if (!mediaTypes.includes('image')) return false;
  const scope = applies_to?.scope ?? { level: 'global' };
  if (!scope.level || scope.level === 'global') return true;
  // Future: campaign/adset/creative/ad_account scoping. v1 only honors global + creative.
  if (scope.level === 'creative' && scope.id) return creative.id === scope.id;
  return true;
}

async function applyTransform(
  img: Image,
  rule: PipelineRule,
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<Image> {
  if (rule.transform_type === 'logo_overlay') {
    const params = rule.transform_params as {
      asset_id?: string;
      position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
      padding_pct?: number;
      opacity?: number;
      max_size_pct?: number;
    };
    if (!params.asset_id) return img;
    const { data: asset } = await supabase
      .from('creative_assets')
      .select('storage_path')
      .eq('id', params.asset_id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!asset) return img;
    const { data: logoBlob } = await supabase.storage
      .from('pipeline-assets')
      .download(asset.storage_path);
    if (!logoBlob) return img;

    let logo = await Image.decode(new Uint8Array(await logoBlob.arrayBuffer()));
    const maxSizePct = params.max_size_pct ?? 15;
    const paddingPct = params.padding_pct ?? 5;
    const opacity = Math.max(0, Math.min(1, params.opacity ?? 1));
    const position = params.position ?? 'top-right';

    const targetSide = Math.floor(Math.min(img.width, img.height) * (maxSizePct / 100));
    const scale = targetSide / Math.max(logo.width, logo.height);
    if (scale < 1) {
      logo = logo.resize(Math.max(1, Math.floor(logo.width * scale)), Math.max(1, Math.floor(logo.height * scale)));
    }

    const padX = Math.floor((img.width * paddingPct) / 100);
    const padY = Math.floor((img.height * paddingPct) / 100);
    const positions: Record<string, [number, number]> = {
      'top-right': [img.width - logo.width - padX, padY],
      'top-left': [padX, padY],
      'bottom-right': [img.width - logo.width - padX, img.height - logo.height - padY],
      'bottom-left': [padX, img.height - logo.height - padY],
      'center': [Math.floor((img.width - logo.width) / 2), Math.floor((img.height - logo.height) / 2)],
    };
    const [x, y] = positions[position] ?? positions['top-right'];

    if (opacity < 1 && typeof (logo as unknown as { opacity?: (o: number) => void }).opacity === 'function') {
      (logo as unknown as { opacity: (o: number) => void }).opacity(opacity);
    }
    img.composite(logo, Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)));
  }
  // Outros transforms (caption, color_filter, ...) fora do escopo v1.
  return img;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const guard = await requireTenant(req, supabaseAdmin, { cors });
  if (!guard.ok) return guard.response;
  const { companyId } = guard.value;

  let body: {
    creative_id?: string;
    source_storage_path?: string;
    source_bucket?: string;
    target_table?: 'creatives' | 'creatives_generated';
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const creativeId = body.creative_id;
  const targetTable = body.target_table === 'creatives_generated' ? 'creatives_generated' : 'creatives';
  // creatives_generated: bucket default = 'generated-creatives'; creatives: 'creatives'
  const sourceBucket = body.source_bucket ?? (targetTable === 'creatives_generated' ? 'generated-creatives' : 'creatives');

  if (!creativeId) {
    return new Response(JSON.stringify({ error: 'missing_creative_id' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 1. Buscar criativo (valida tenant) — usa storage_path do banco se nao fornecido
  const { data: creative } = await supabaseAdmin
    .from(targetTable)
    .select('id, company_id, storage_path, pipeline_applied_rules')
    .eq('id', creativeId)
    .maybeSingle();
  if (!creative || creative.company_id !== companyId) {
    return new Response(JSON.stringify({ error: 'creative_not_found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  // Idempotency: se ja teve pipeline aplicado, pula
  if (Array.isArray(creative.pipeline_applied_rules) && creative.pipeline_applied_rules.length > 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_applied', applied_rule_ids: creative.pipeline_applied_rules }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  const sourcePath = body.source_storage_path ?? creative.storage_path;
  if (!sourcePath) {
    return new Response(JSON.stringify({ error: 'missing_source_path' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 2. Regras ativas
  const { data: rules } = await supabaseAdmin
    .from('creative_pipeline_rules')
    .select('id, transform_type, transform_params, applies_to, priority')
    .eq('company_id', companyId)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });

  if (!rules?.length) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_active_rules' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 3. Baixar imagem original
  const { data: srcBlob, error: dlErr } = await supabaseAdmin.storage
    .from(sourceBucket)
    .download(sourcePath);
  if (dlErr || !srcBlob) {
    return new Response(JSON.stringify({ error: 'source_download_failed', detail: dlErr?.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let img: Image;
  try {
    img = await Image.decode(new Uint8Array(await srcBlob.arrayBuffer()));
  } catch (decodeErr) {
    return new Response(JSON.stringify({ error: 'decode_failed', detail: String(decodeErr) }), {
      status: 422,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 4. Aplicar regras em ordem
  const applied: string[] = [];
  for (const rule of rules as PipelineRule[]) {
    if (!matchesScope(rule.applies_to, creative)) continue;
    try {
      img = await applyTransform(img, rule, supabaseAdmin, companyId);
      applied.push(rule.id);
    } catch (e) {
      console.warn('[apply-creative-pipeline] rule failed:', rule.id, e);
    }
  }

  if (applied.length === 0) {
    // Marca como skipped no creative pra UI nao tentar de novo
    await supabaseAdmin
      .from(targetTable)
      .update({ pipeline_status: 'skipped' })
      .eq('id', creativeId);
    return new Response(JSON.stringify({ skipped: true, reason: 'no_rule_matched' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 5. Encodar + upload
  const finalBytes = await img.encode();
  const finalPath = `${companyId}/${creativeId}-pipeline-${Date.now()}.png`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(sourceBucket)
    .upload(finalPath, finalBytes, { contentType: 'image/png', upsert: false });
  if (upErr) {
    return new Response(JSON.stringify({ error: 'upload_failed', detail: upErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // 6. UPDATE creative — campos comuns: pipeline_applied_rules + pipeline_source_path
  // creatives (Meta): atualiza media_url; creatives_generated: atualiza storage_path
  const { data: pub } = supabaseAdmin.storage.from(sourceBucket).getPublicUrl(finalPath);
  const newUrl = pub?.publicUrl ?? null;
  const updatePayload: Record<string, unknown> = {
    pipeline_applied_rules: applied,
    pipeline_source_path: sourcePath,
    pipeline_status: 'applied',
  };
  if (targetTable === 'creatives' && newUrl) {
    updatePayload.media_url = newUrl;
  } else if (targetTable === 'creatives_generated') {
    updatePayload.storage_path = finalPath;
  }
  await supabaseAdmin
    .from(targetTable)
    .update(updatePayload)
    .eq('id', creativeId);

  // 7. Update rules.last_applied_at (fire-and-forget)
  supabaseAdmin
    .from('creative_pipeline_rules')
    .update({ last_applied_at: new Date().toISOString() })
    .in('id', applied)
    .then(() => {});

  return new Response(
    JSON.stringify({
      transformed_storage_path: finalPath,
      applied_rule_ids: applied,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
