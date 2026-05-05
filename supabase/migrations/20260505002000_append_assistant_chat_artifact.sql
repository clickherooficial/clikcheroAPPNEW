-- Persiste mensagem assistant (ex.: galeria apos Variar/Iterar na UI) — backlog item 9.
-- SECURITY DEFINER: valida auth.uid() = dono da conversa.

CREATE OR REPLACE FUNCTION public.append_assistant_chat_artifact(
  p_conversation_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mid uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'empty content';
  END IF;

  PERFORM 1
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id
    AND c.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  INSERT INTO public.chat_messages (conversation_id, role, content, metadata)
  VALUES (
    p_conversation_id,
    'assistant',
    p_content,
    jsonb_build_object('source', 'creative_ui_action')
  )
  RETURNING id INTO v_mid;

  UPDATE public.chat_conversations
  SET
    message_count = COALESCE(message_count, 0) + 1,
    updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_mid;
END;
$$;

COMMENT ON FUNCTION public.append_assistant_chat_artifact(uuid, text) IS
  'Insere mensagem assistant na conversa do usuario (ex. tag creative-gallery apos acao na galeria).';

REVOKE ALL ON FUNCTION public.append_assistant_chat_artifact(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_assistant_chat_artifact(uuid, text) TO authenticated;
