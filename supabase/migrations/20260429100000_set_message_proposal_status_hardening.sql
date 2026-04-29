-- Hardening: set_message_proposal_status
-- - COALESCE(metadata) evita null em jsonb_set
-- - create_missing true garante metadata.proposed_rule.status mesmo se a chave sumiu
-- - path explicito como text[]

CREATE OR REPLACE FUNCTION public.set_message_proposal_status(
  p_message_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id uuid;
  v_user_id uuid;
  v_metadata jsonb;
BEGIN
  IF p_new_status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid status: %', p_new_status USING ERRCODE = '22023';
  END IF;

  SELECT cm.conversation_id, cm.metadata
    INTO v_conversation_id, v_metadata
    FROM public.chat_messages cm
   WHERE cm.id = p_message_id;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = '42704';
  END IF;

  SELECT cc.user_id INTO v_user_id
    FROM public.chat_conversations cc
   WHERE cc.id = v_conversation_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  IF v_metadata IS NULL OR v_metadata->'proposed_rule' IS NULL THEN
    RAISE EXCEPTION 'no proposed_rule on message' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_metadata->'proposed_rule') <> 'object' THEN
    RAISE EXCEPTION 'proposed_rule metadata must be a json object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_messages
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::jsonb),
       ARRAY['proposed_rule', 'status']::text[],
       to_jsonb(p_new_status),
       true
     )
   WHERE id = p_message_id;
END;
$$;

COMMENT ON FUNCTION public.set_message_proposal_status(uuid, text) IS
  'Atualiza metadata.proposed_rule.status (jsonb_set com create_missing). Valida conversa = auth.uid().';
