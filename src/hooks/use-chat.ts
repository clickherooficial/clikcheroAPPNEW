import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ACTIVE_CONVERSATION_KEY = 'clickhero:active-conversation-id';

export interface ComplianceAction {
  prohibition?: { value: string; category: 'word' | 'topic' | 'visual' };
  rescan?: { scanned: number; violations: number; taken_down: number };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** IDs em chat_attachments (so user message com anexos) */
  attachmentIds?: string[];
  /** Card violeta inline com resultado de add_prohibition / rescan_compliance */
  complianceAction?: ComplianceAction;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persiste o id da conversa ativa pra sobreviver ao F5 (UX igual ChatGPT/Claude/Gemini).
  // IMPORTANTE: so escreve quando ha id; nunca limpa aqui. Limpeza explicita
  // vive em newConversation/loadConversation. Caso contrario, no mount o
  // conversationId inicial=null disparava removeItem ANTES do effect de
  // restauracao ler a chave — e a conversa "sumia" no F5.
  useEffect(() => {
    if (!conversationId) return;
    try { localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId); } catch { /* ignore */ }
  }, [conversationId]);

  // No mount, recupera a conversa ativa do localStorage e carrega o historico do banco
  useEffect(() => {
    let cancelled = false;
    const stored = (() => {
      try { return localStorage.getItem(ACTIVE_CONVERSATION_KEY); } catch { return null; }
    })();
    if (!stored) return;

    (async () => {
      const { data, error } = await supabase
        .from('chat_messages' as never)
        .select('id, role, content, created_at, metadata')
        .eq('conversation_id', stored)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error || !data) {
        try { localStorage.removeItem(ACTIVE_CONVERSATION_KEY); } catch { /* ignore */ }
        return;
      }
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        created_at: string;
        metadata: { attachments?: string[] } | null;
      }>;
      const history: ChatMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        timestamp: new Date(r.created_at),
        attachmentIds:
          r.role === 'user' && Array.isArray(r.metadata?.attachments)
            ? r.metadata!.attachments
            : undefined,
      }));
      setConversationId(stored);
      setMessages(history);
    })();

    return () => { cancelled = true; };
  }, []);

  // Carrega uma conversa existente (id + historico de mensagens vindo do servidor)
  const loadConversation = useCallback((id: string, history: ChatMessage[]) => {
    setConversationId(id);
    setMessages(history);
    setStatus(null);
  }, []);

  const sendMessage = useCallback(async (content: string, attachmentIds: string[] = [], metadata?: Record<string, unknown>) => {
    if ((!content.trim() && attachmentIds.length === 0) || isStreaming) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder assistant message
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
    ]);

    setIsStreaming(true);
    setStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      abortRef.current = new AbortController();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            message: content.trim(),
            conversation_id: conversationId,
            attachment_ids: attachmentIds,
            client_metadata: metadata ?? null,
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'content') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
                )
              );
            } else if (data.type === 'status') {
              setStatus(data.content);
            } else if (data.type === 'done') {
              if (data.conversation_id) {
                setConversationId(data.conversation_id);
              }
              const ca = data.metadata?.compliance_action as ComplianceAction | null | undefined;
              if (ca && (ca.prohibition || ca.rescan)) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, complianceAction: ca } : m
                  )
                );
              }
            } else if (data.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: data.content || 'Erro ao processar resposta', isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `Erro: ${(error as Error).message || 'Falha na conexao'}. Tente novamente.`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setStatus(null);
      abortRef.current = null;
    }
  }, [isStreaming, conversationId]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStatus(null);
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setStatus(null);
    try { localStorage.removeItem(ACTIVE_CONVERSATION_KEY); } catch { /* ignore */ }
  }, []);

  // B4: Insights proativos — envia mensagem automatica ao criar nova conversa
  const loadProactiveInsights = useCallback(() => {
    if (messages.length > 0 || isStreaming) return;
    sendMessage('[SISTEMA] Resuma brevemente: acoes FURY pendentes, campanhas criticas, e alertas de compliance. Se tudo estiver ok, cumprimente e pergunte como posso ajudar.');
  }, [messages.length, isStreaming, sendMessage]);

  return {
    messages,
    isStreaming,
    status,
    conversationId,
    sendMessage,
    stopStreaming,
    newConversation,
    loadConversation,
    loadProactiveInsights,
  };
}
