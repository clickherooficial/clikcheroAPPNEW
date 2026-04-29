import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Square, Search, FileBarChart, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/use-chat";
import { useAttachments } from "@/hooks/use-attachments";
import { useToast } from "@/hooks/use-toast";
import { ProactiveBanner } from "@/components/chat/ProactiveBanner";
import { InlineApprovalCards } from "@/components/chat/InlineApprovalCard";
import { InlineRuleProposalCards } from "@/components/fury/InlineRuleProposalCards";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { ComplianceActionCard } from "@/components/chat/ComplianceActionCard";
import { AttachmentPicker } from "@/components/chat/AttachmentPicker";
import { AttachmentDropzone } from "@/components/chat/AttachmentDropzone";
import { AttachmentPreviewList } from "@/components/chat/AttachmentPreview";
import { MessageAttachments } from "@/components/chat/MessageAttachments";
import { CitationRenderer } from "@/components/knowledge/CitationRenderer";
import { ChatCreativeGallery } from "@/components/creatives-studio/ChatCreativeGallery";

const suggestions = [
  "Qual o desempenho das minhas campanhas nos ultimos 7 dias",
  "Criar nova campanha de venda / Quero vender mais",
  "Compare essa semana com a anterior",
  "Criar nova campanha de engajamento / Quero ser visto",
];

const quickReports = [
  {
    icon: FileBarChart,
    label: "Relatorio Semanal",
    description: "Visao geral 7 dias com variacao + top campanhas",
    prompt: "Me da um relatorio semanal completo das minhas campanhas",
  },
  {
    icon: Sparkles,
    label: "Crie imagens de criativos para anunciar",
    description: "Pedido para gerar imagens de anuncio com base no seu briefing",
    prompt:
      "Quero criar imagens de criativos para anunciar no Meta. Use meu briefing, ofertas e identidade visual. Sugira conceitos e gere as imagens.",
  },
];

const ChatView = () => {
  const {
    messages,
    isStreaming,
    status,
    conversationId,
    sendMessage,
    stopStreaming,
    newConversation,
    loadConversation,
    loadProactiveInsights,
  } = useChat();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const proactiveLoaded = useRef(false);
  const { toast } = useToast();
  const attachments = useAttachments(conversationId);

  // Mostra erros de validacao via toast
  useEffect(() => {
    if (attachments.validationErrors.length > 0) {
      attachments.validationErrors.forEach((err) =>
        toast({ title: "Anexo nao aceito", description: err, variant: "destructive" })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.validationErrors]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // B3: O auto-greeting LLM foi substituido pelo <ProactiveBanner /> (zero-cost,
  // baseado em RPC get_proactive_briefing). Mantemos a funcao loadProactiveInsights
  // disponivel pra fallback / botao manual, mas nao chamamos automaticamente.
  void loadProactiveInsights;
  void proactiveLoaded;

  const hasContent = input.trim().length > 0 || attachments.readyAttachmentIds.length > 0;
  const sendDisabled = isStreaming || attachments.isBusy || !hasContent;

  const handleSend = () => {
    if (sendDisabled) return;
    sendMessage(input, attachments.readyAttachmentIds);
    setInput("");
    attachments.clear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isStreaming) return;
    sendMessage(suggestion);
  };

  // Simple markdown-ish rendering: bold, tables, lists
  const renderContent = (content: string) => {
    if (!content) return null;

    // Detecta <creative-gallery ids="a,b,c"/> e troca por placeholder unico no texto.
    // Renderiza o componente real quando o placeholder aparece nos lines.
    const galleryRegex = /<creative-gallery\s+ids="([^"]+)"\s*\/?>/g;
    const galleries: Array<{ key: string; ids: string[] }> = [];
    const contentWithMarkers = content.replace(galleryRegex, (_, idsStr: string) => {
      const ids = idsStr.split(',').map((s) => s.trim()).filter(Boolean);
      const key = `__CREATIVE_GALLERY_${galleries.length}__`;
      galleries.push({ key, ids });
      return `\n${key}\n`;
    });

    const lines = contentWithMarkers.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    const processInline = (text: string): React.ReactNode => {
      // Bold
      const parts = text.split(/\*\*(.*?)\*\*/g);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="font-semibold">{part}</strong>;
        }
        // Texto comum — substitui refs [doc:UUID#chunk:N] via CitationRenderer
        // (no-op se nao houver refs no segmento)
        return <CitationRenderer key={i} text={part} />;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Creative gallery placeholder
      const galleryMatch = line.match(/^__CREATIVE_GALLERY_(\d+)__$/);
      if (galleryMatch) {
        const idx = Number(galleryMatch[1]);
        const g = galleries[idx];
        if (g) {
          elements.push(<ChatCreativeGallery key={`gal-${i}`} ids={g.ids} />);
        }
        continue;
      }

      // Table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        // Skip separator rows (|---|---|)
        if (cells.every(c => /^[-:]+$/.test(c))) {
          continue;
        }
        tableRows.push(cells);
        inTable = true;
        continue;
      }

      // End of table
      if (inTable && tableRows.length > 0) {
        const headers = tableRows[0];
        const rows = tableRows.slice(1);
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {headers.map((h, hi) => (
                    <th key={hi} className="text-left px-2 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/40">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-foreground/80">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }

      // Headers
      if (line.startsWith('## ')) {
        elements.push(<h3 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.slice(3)}</h3>);
        continue;
      }

      // List items
      if (line.match(/^[-*] /)) {
        elements.push(
          <div key={i} className="flex gap-2 ml-1">
            <span className="text-primary mt-0.5">•</span>
            <span>{processInline(line.slice(2))}</span>
          </div>
        );
        continue;
      }

      // Numbered list
      if (line.match(/^\d+\. /)) {
        const match = line.match(/^(\d+)\. (.*)$/);
        if (match) {
          elements.push(
            <div key={i} className="flex gap-2 ml-1">
              <span className="text-primary/70 font-mono text-xs mt-0.5">{match[1]}.</span>
              <span>{processInline(match[2])}</span>
            </div>
          );
          continue;
        }
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<div key={i} className="h-1.5" />);
        continue;
      }

      // Regular text
      elements.push(<p key={i}>{processInline(line)}</p>);
    }

    // Flush remaining table
    if (inTable && tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div key="table-end" className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h, hi) => (
                  <th key={hi} className="text-left px-2 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-foreground/80">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="flex h-full bg-background relative">
      {/* Drawer de conversas anteriores (toggle por botao) */}
      {historyOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="absolute md:relative left-0 top-0 bottom-0 z-40 w-72 shrink-0 border-r border-border/50 bg-card flex flex-col">
            <ChatHistorySidebar
              currentConversationId={conversationId}
              onSelectConversation={(id, history) => {
                loadConversation(id, history);
                if (window.matchMedia('(max-width: 767px)').matches) setHistoryOpen(false);
              }}
              onNewConversation={() => {
                newConversation();
                if (window.matchMedia('(max-width: 767px)').matches) setHistoryOpen(false);
              }}
            />
          </aside>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
      {/* Toolbar superior */}
      <div className="flex items-center gap-2 px-4 md:px-6 pt-3">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          aria-label="Toggle historico de conversas"
        >
          <PanelLeft className="h-3.5 w-3.5" />
          Historico de conversas
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 md:py-8 space-y-4">
        {/* Welcome + Suggestions (only when no messages) */}
        {messages.length === 0 && (
          <div className="mx-auto w-full max-w-3xl animate-fade-in">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cf6f03_0%,#e8850a_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.2),_0_8px_24px_-6px_rgb(207_111_3/0.5)]">
                <Sparkles className="h-7 w-7 text-white" strokeWidth={2} />
              </div>
              <h2 className="text-display-sm font-semibold tracking-tight text-foreground">Assistente ClickHero</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Seu co-piloto de Meta Ads com dados em tempo real das suas campanhas
              </p>
            </div>

            {/* B3: Briefing proativo (insights baseados em memorias + metricas) */}
            <ProactiveBanner onAsk={(p) => sendMessage(p)} />

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="group rounded-xl border border-border/60 bg-card p-4 text-left text-[13px] text-muted-foreground shadow-e1 transition-all duration-base ease-smooth hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40 hover:text-foreground hover:shadow-e2"
                >
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60 transition-colors group-hover:text-primary" strokeWidth={2} />
                    <span className="leading-snug">{s}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Relatorios Rapidos
              </div>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {quickReports.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.label}
                      onClick={() => handleSuggestionClick(r.prompt)}
                      className="group rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 text-left transition-all duration-base ease-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:from-primary/10"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-foreground">{r.label}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                            {r.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Message bubbles — oculta mensagens [SISTEMA] do usuario */}
        {messages.filter((m) => !(m.role === 'user' && m.content.startsWith('[SISTEMA]'))).map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div
              className={cn(
                "max-w-3xl mx-auto w-full slide-up",
                msg.role === "user" ? "flex justify-end" : ""
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md max-w-[80%] whitespace-pre-wrap"
                    : "bg-chat-ai text-chat-ai-foreground rounded-bl-md space-y-0.5"
                )}
              >
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                {msg.role === 'user' && msg.attachmentIds && msg.attachmentIds.length > 0 && (
                  <MessageAttachments attachmentIds={msg.attachmentIds} />
                )}
                {msg.isStreaming && !msg.content && (
                  <div className="inline-flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse-soft" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse-soft [animation-delay:0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse-soft [animation-delay:0.6s]" />
                  </div>
                )}
              </div>
            </div>
            {msg.role === 'assistant' && msg.complianceAction && (
              <ComplianceActionCard action={msg.complianceAction} />
            )}
          </div>
        ))}

        {/* B4: Approvals/plans inline da conversation atual */}
        <InlineApprovalCards conversationId={conversationId} />

        {/* Fury Learning: propostas de regra inline */}
        <InlineRuleProposalCards conversationId={conversationId} />

        {/* Status indicator (e.g., "Buscando dados...") */}
        {status && (
          <div className="max-w-3xl mx-auto w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary/70">
              <Search className="w-3 h-3 animate-pulse" />
              {status}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/60 bg-background p-4 md:p-6">
        <div className="max-w-3xl mx-auto w-full">
          <AttachmentDropzone
            onFiles={(files) => attachments.addFiles(files)}
            disabled={isStreaming}
            className="bg-card border border-border/60 rounded-2xl focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm"
          >
            <AttachmentPreviewList pending={attachments.pending} onRemove={attachments.remove} />
            <div className="flex items-end gap-2 p-2">
              <AttachmentPicker
                onPick={(files) => attachments.addFiles(files)}
                disabled={isStreaming}
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre suas campanhas..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none py-2 max-h-32"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  type="button"
                  aria-label="Parar resposta"
                  onClick={stopStreaming}
                  className="rounded-xl bg-red-100 p-2 text-red-600 transition-all hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                >
                  <Square className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={attachments.isBusy ? "Aguardando anexos" : "Enviar mensagem"}
                  onClick={handleSend}
                  disabled={sendDisabled}
                  className={cn(
                    "rounded-xl p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    !sendDisabled
                      ? "bg-[linear-gradient(135deg,#cf6f03_0%,#e8850a_100%)] text-white shadow-e2 hover:shadow-e3 active:scale-[0.98]"
                      : "text-muted-foreground/40",
                  )}
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </AttachmentDropzone>
          <div className="flex items-center justify-between mt-2.5">
            {messages.length > 0 && (
              <button
                onClick={newConversation}
                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Nova conversa
              </button>
            )}
            <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1 ml-auto">
              <Sparkles className="w-3 h-3" />
              GPT-4o + dados reais Meta Ads
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatView;
