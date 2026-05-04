// Handler da tool `publish_campaign` do orchestrator (ai-chat).
// Spec: chat-publish-flow (tasks 6.1, 6.3)
//
// Aprovacao humana via card -> mensagem [SISTEMA] no chat dispara LLM ->
// LLM invoca esta tool -> handler valida proposal, regenera signed URL,
// monta body Zod do campaign-publish e invoca a Edge Function existente.
// Proposal status: pending_approval -> publishing | failed.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import {
  mapProposalToCampaignBody,
  type CampaignProposalPayload,
} from './campaign-proposal-helpers.ts';

const PUBLISH_TIMEOUT_MS = 55_000;

// ============================================================
// Validacao do input
// ============================================================

const InputSchema = z.object({
  proposal_id: z.string().uuid('proposal_id deve ser UUID'),
});

// ============================================================
// Tipos do erro estruturado (espelha frontend)
// ============================================================

type ErrorKind = 'validation' | 'compliance' | 'upstream' | 'timeout' | 'wrong_status' | 'proposal_not_found' | 'unknown';

interface ErrorPayload {
  error_kind: ErrorKind;
  message: string;
  raw?: unknown;
  failed_at_step?: string;
}

// ============================================================
// Handler
// ============================================================

export async function handlePublishCampaign(
  supabase: SupabaseClient,        // service-role (bypassa RLS pra UPDATE)
  companyId: string,
  authHeader: string,              // user JWT — repassado pro campaign-publish (audit trail correto)
  args: unknown,
): Promise<string> {
  // 1) Validacao do input
  const parsed = InputSchema.safeParse(args);
  if (!parsed.success) {
    return `Erro de validacao em publish_campaign: ${parsed.error.issues[0]?.message}. Diga ao usuario que algo deu errado.`;
  }
  const { proposal_id } = parsed.data;

  // 2) Carrega proposal e valida estado
  const { data: proposal, error: loadErr } = await supabase
    .from('campaign_proposals')
    .select('id, company_id, creative_id, payload_jsonb, status, publication_id')
    .eq('id', proposal_id)
    .maybeSingle();

  if (loadErr) {
    console.error('[publish_campaign] load failed:', loadErr);
    return 'Erro interno ao buscar a proposta. Diga ao usuario que tive um problema e ele pode tentar de novo.';
  }
  if (!proposal) {
    await markFailed(supabase, proposal_id, { error_kind: 'proposal_not_found', message: 'Proposta nao existe.' });
    return 'A proposta referenciada nao existe ou expirou. Diga ao usuario que precisa criar uma nova.';
  }
  if (proposal.company_id !== companyId) {
    return 'Erro: proposta pertence a outro tenant. Diga ao usuario que algo deu errado.';
  }
  if (proposal.status !== 'pending_approval') {
    return `Essa proposta nao esta mais pendente de aprovacao (status atual: ${proposal.status}). Diga ao usuario o que aconteceu — se foi 'live' ela ja esta no ar, se 'failed' pode pedir pra tentar de novo, se 'cancelled' precisa criar nova.`;
  }

  const payload = proposal.payload_jsonb as CampaignProposalPayload;

  // 3) Regenerar signed URL fresh do criativo (TTL 15min)
  const { data: creative } = await supabase
    .from('creatives_generated')
    .select('storage_path')
    .eq('id', proposal.creative_id)
    .maybeSingle();

  if (!creative) {
    await markFailed(supabase, proposal_id, { error_kind: 'validation', message: 'Criativo da proposta nao existe mais.' });
    return 'O criativo da proposta nao esta mais disponivel. Diga ao usuario que precisa gerar uma nova imagem.';
  }
  const { data: signed } = await supabase.storage
    .from('generated-creatives')
    .createSignedUrl(creative.storage_path, 60 * 15);
  const fresh_url = signed?.signedUrl;
  if (!fresh_url) {
    await markFailed(supabase, proposal_id, { error_kind: 'upstream', message: 'Falha ao gerar URL da imagem.' });
    return 'Tive um problema pra acessar sua imagem. Diga ao usuario LITERALMENTE: "Houve um erro temporario com o armazenamento, posso tentar de novo agora?"';
  }

  // 4) Map proposal -> campaign-publish body
  // Fix 2 (chat-publish-flow): pede auto_activate pra Edge Fn nao deixar PAUSED.
  // Mantem o create como PAUSED no schema (atomicidade) e a Edge Fn ativa logo depois.
  const body = { ...mapProposalToCampaignBody(payload, fresh_url), auto_activate: true };

  // 5) Invoca campaign-publish com user JWT (audit trail correto)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/campaign-publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader, // ja vem como "Bearer <token>"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
    const kind: ErrorKind = isTimeout ? 'timeout' : 'upstream';
    await markFailed(supabase, proposal_id, {
      error_kind: kind,
      message: isTimeout ? 'A publicacao excedeu 55s.' : ((err as Error)?.message ?? 'fetch falhou'),
    });
    return isTimeout
      ? 'Diga ao usuario LITERALMENTE: "A publicacao demorou mais que o esperado e foi cancelada. Posso tentar de novo agora?"'
      : 'Diga ao usuario LITERALMENTE: "Houve um erro temporario no Meta, posso tentar de novo agora?"';
  }

  const durationMs = Date.now() - t0;
  const text = await resp.text();
  let respBody: Record<string, unknown> = {};
  try { respBody = JSON.parse(text) as Record<string, unknown>; } catch { /* keep empty */ }

  // 6) Tratar resposta
  if (resp.ok) {
    const publication_id = (respBody.publication_id ?? respBody.id) as string | undefined;
    if (!publication_id) {
      await markFailed(supabase, proposal_id, {
        error_kind: 'unknown',
        message: 'Edge campaign-publish retornou OK mas sem publication_id.',
        raw: respBody,
      });
      return 'A publicacao retornou um resultado inesperado. Diga ao usuario que precisa investigar.';
    }

    const activated = Boolean(respBody.activated);
    const activation_error = respBody.activation_error as string | null | undefined;

    await supabase
      .from('campaign_proposals')
      .update({
        status: activated ? 'live' : 'publishing',
        publication_id,
        error_payload: activation_error ? { error_kind: 'upstream', message: activation_error, failed_at_step: 'activation' } : null,
      } as never)
      .eq('id', proposal_id);

    if (activated) {
      return `Anuncio publicado E ATIVADO no Meta. Esta veiculando agora (publication_id: ${publication_id}). Tempo: ${durationMs}ms. Diga ao usuario LITERALMENTE: "Pronto! Seu anuncio ja esta rodando 🚀. Os primeiros resultados aparecem em algumas horas."`;
    }

    if (activation_error) {
      return `Anuncio FOI CRIADO mas a ativacao falhou (${activation_error}). publication_id=${publication_id}. Diga ao usuario LITERALMENTE: "Seu anuncio foi criado mas teve um problema pra deixar ele no ar. Posso tentar ativar de novo agora ou voce prefere ativar manualmente no painel?"`;
    }

    return `Comecei a publicar! Em alguns segundos seu anuncio vai estar no ar. Vou te avisar aqui mesmo quando confirmar (publication_id: ${publication_id}). Tempo de processamento: ${durationMs}ms.`;
  }

  // Erro do edge fn — distingue compliance (422) vs validation (400) vs upstream (5xx)
  const status = resp.status;
  let kind: ErrorKind = 'unknown';
  let failedStep: string | undefined;
  const rawErrorMsg = String(respBody.error ?? respBody.message ?? text).slice(0, 300);

  if (status === 422 || /compliance/i.test(rawErrorMsg)) {
    kind = 'compliance';
    failedStep = 'compliance';
  } else if (status >= 400 && status < 500) {
    kind = 'validation';
    failedStep = String(respBody.error_stage ?? 'validation');
  } else if (status >= 500) {
    kind = 'upstream';
  }

  await markFailed(supabase, proposal_id, {
    error_kind: kind,
    message: rawErrorMsg,
    raw: respBody,
    failed_at_step: failedStep,
  });

  if (kind === 'compliance') {
    return `Diga ao usuario LITERALMENTE: "Seu anuncio foi bloqueado por compliance: ${rawErrorMsg}. Quer que eu sugira ajustes no texto pra liberar?"`;
  }
  if (kind === 'validation') {
    return `Diga ao usuario LITERALMENTE: "Algo nos dados da proposta nao foi aceito pelo Meta: ${rawErrorMsg}. Posso editar e tentar de novo?"`;
  }
  if (kind === 'upstream') {
    return 'Diga ao usuario LITERALMENTE: "Houve um erro temporario no Meta, posso tentar de novo agora?"';
  }
  return `A publicacao falhou (HTTP ${status}). Diga ao usuario LITERALMENTE: "Algo deu errado: ${rawErrorMsg}. Quer tentar de novo?"`;
}

// ============================================================
// Helpers
// ============================================================

async function markFailed(
  supabase: SupabaseClient,
  proposalId: string,
  error: ErrorPayload,
): Promise<void> {
  await supabase
    .from('campaign_proposals')
    .update({ status: 'failed', error_payload: error } as never)
    .eq('id', proposalId);
}
