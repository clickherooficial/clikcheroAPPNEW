-- Migration: chat-publish-flow — campaign_proposals (HITL no chat)
-- Spec: .kiro/specs/chat-publish-flow/
-- Tasks: 1.1, 1.2
--
-- Tabela de propostas de campanha originadas no chat. Lifecycle:
--   pending_approval -> publishing -> live | failed
--   pending_approval -> cancelled (usuario)
--   pending_approval -> expired (cron, default 24h)
--
-- Conecta o card inline do chat com o edge `campaign-publish` existente.
-- INSERT bloqueado a usuarios — apenas service-role (handler propose_campaign).
-- DELETE bloqueado — audit trail; cleanup via UPDATE status='expired' cron.
--
-- Seguranca: ADITIVO. Nenhuma tabela existente alterada. RLS via
-- current_user_company_id() (mesma convencao do projeto).

-- ============================================================
-- Tabela
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL
    REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Origem (de onde veio a proposta no chat)
  conversation_id uuid NOT NULL
    REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  created_by_message_id uuid
    REFERENCES public.chat_messages(id) ON DELETE SET NULL,

  -- Criativo de referencia (imagem que vai pra Meta)
  -- creatives_generated e a tabela usada pelo chat (<creative-gallery>)
  creative_id uuid NOT NULL
    REFERENCES public.creatives_generated(id) ON DELETE RESTRICT,

  -- Payload completo da campanha (objective, budget, audience, copy, snapshots de prereq).
  -- Schema validado no client (Zod) e no edge campaign-publish.
  payload_jsonb jsonb NOT NULL,

  -- Resultado do compliance preview (severity, score, hits, duration_ms).
  -- Pode ficar vazio se preview falhou — gate definitivo no campaign-publish.
  compliance_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'cancelled', 'publishing', 'live', 'failed', 'expired')),

  -- Vinculo com publicacao real (preenchido no publish_campaign)
  publication_id uuid
    REFERENCES public.campaign_publications(id) ON DELETE SET NULL,

  -- Causa de failure estruturada (error_kind + message + raw)
  error_payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Proposta expira em 24h se ninguem decidir (cron move pra status='expired')
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS campaign_proposals_company_created_idx
  ON public.campaign_proposals(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_proposals_conversation_status_idx
  ON public.campaign_proposals(conversation_id, status);

-- Partial index para o cron de expiracao (so escaneia o que importa)
CREATE INDEX IF NOT EXISTS campaign_proposals_pending_expires_idx
  ON public.campaign_proposals(expires_at)
  WHERE status = 'pending_approval';

-- ============================================================
-- Trigger updated_at (segue padrao do projeto)
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_campaign_proposals_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_campaign_proposals_updated_at ON public.campaign_proposals;
CREATE TRIGGER touch_campaign_proposals_updated_at
  BEFORE UPDATE ON public.campaign_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_campaign_proposals_updated_at();

-- ============================================================
-- RLS — Task 1.2
-- ============================================================
ALTER TABLE public.campaign_proposals ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant scope
DROP POLICY IF EXISTS "campaign_proposals_select" ON public.campaign_proposals;
CREATE POLICY "campaign_proposals_select" ON public.campaign_proposals
  FOR SELECT USING (company_id = public.current_user_company_id());

-- UPDATE: tenant scope (usuario pode cancelar/editar suas proprias propostas)
DROP POLICY IF EXISTS "campaign_proposals_update" ON public.campaign_proposals;
CREATE POLICY "campaign_proposals_update" ON public.campaign_proposals
  FOR UPDATE USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

-- INSERT: BLOQUEADO para usuarios. Apenas service-role (handler propose_campaign no edge fn).
-- Justificativa: a tool valida prereqs, roda compliance preview e monta payload completo
-- antes de inserir. Insercao direta pelo client desviaria desses gates.
DROP POLICY IF EXISTS "campaign_proposals_insert_blocked" ON public.campaign_proposals;
CREATE POLICY "campaign_proposals_insert_blocked" ON public.campaign_proposals
  FOR INSERT WITH CHECK (false);

-- DELETE: BLOQUEADO. Audit trail imutavel. Cleanup via UPDATE status='expired'.
-- (Nenhuma policy de DELETE = todas as tentativas falham)

-- ============================================================
-- Realtime publication (frontend subscreve via channel
-- `campaign-proposal-${id}` filtrado por id)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_proposals;
  END IF;
END $$;

COMMENT ON TABLE public.campaign_proposals IS
  'Propostas de campanha geradas via chat (tool propose_campaign). Renderizadas inline como InlineCampaignProposalCard. Aprovacao dispara edge campaign-publish. Lifecycle: pending_approval -> cancelled | publishing -> live | failed | expired.';

COMMENT ON COLUMN public.campaign_proposals.payload_jsonb IS
  'Schema CampaignProposalPayload (ver src/types/campaign-proposal.ts): objective, campaign_name, daily_budget_brl, audience, copy, snapshots de prereq.';

COMMENT ON COLUMN public.campaign_proposals.compliance_jsonb IS
  'Resultado do preview de compliance: { severity, score, hits[], duration_ms, blocking }. Vazio se preview falhou (badge cinza no card).';
