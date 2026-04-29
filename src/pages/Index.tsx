import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { BriefingCompletenessBanner } from "@/components/briefing/BriefingCompletenessBanner";
import { useBriefingCompleteness } from "@/hooks/use-briefing-completeness";
import ChatView from "@/components/ChatView";
import PainelView from "@/components/PainelView";
import CriativosView from "@/components/CriativosView";
import CerebroFuryView from "@/components/CerebroFuryView";
import ApprovalsView from "@/components/ApprovalsView";
import AiHealthView from "@/components/AiHealthView";
import ComplianceView from "@/components/compliance/ComplianceView";
import CampaignPublisherView from "@/components/publisher/CampaignPublisherView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { onNavigateToView } from "@/lib/view-navigation";

// Sidebar consolidada (5 itens principais + 3 footer/secundarios)
type View = "chat" | "painel" | "criativos" | "cerebro" | "approvals" | "ai-health" | "compliance" | "publisher";

const viewTitles: Record<View, string> = {
  chat: "Meus anúncios",
  painel: "Painel",
  criativos: "Criativos",
  cerebro: "Configuracoes",
  approvals: "Aprovacoes",
  "ai-health": "Saude do AI",
  compliance: "Compliance",
  publisher: "Publicar Campanha",
};

const VIEW_STORAGE_KEY = "clickhero:currentView";
const VALID_VIEWS: View[] = ["chat", "painel", "criativos", "cerebro", "approvals", "ai-health", "compliance", "publisher"];

// Compat: views antigas redirecionam pras novas
const LEGACY_REDIRECT: Record<string, View> = {
  dashboard: 'painel',
  analysis: 'painel',
  budget: 'painel',
  studio: 'criativos',
  creatives: 'criativos',
  fury: 'cerebro',
  memory: 'cerebro',
};

function loadInitialView(): View {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved && VALID_VIEWS.includes(saved as View)) return saved as View;
    if (saved && LEGACY_REDIRECT[saved]) return LEGACY_REDIRECT[saved];
  } catch { /* ignore */ }
  return "chat";
}

const Index = () => {
  const [currentView, setCurrentView] = useState<View>(loadInitialView);
  const { status: briefingStatus, isLoading: briefingLoading } = useBriefingCompleteness();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, currentView);
    } catch { /* ignore */ }
  }, [currentView]);

  // Listener pra navegacao programatica (links contextuais pos-acao do chat)
  useEffect(() => onNavigateToView((view) => setCurrentView(view as View)), []);

  const hasSkipped = (() => {
    try { return !!localStorage.getItem('briefing:skipped-at'); } catch { return false; }
  })();
  if (!briefingLoading && briefingStatus === 'not_started' && !hasSkipped) {
    return <Navigate to="/briefing/wizard" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <BriefingCompletenessBanner />

        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {viewTitles[currentView]}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-8 w-8 rounded-full bg-zinc-800 border border-white/10" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-premium">
          <div className="fade-in h-full">
            {currentView === "chat" && <ChatView />}
            {currentView === "painel" && <PainelView />}
            {currentView === "criativos" && <CriativosView />}
            {currentView === "cerebro" && <CerebroFuryView />}
            {currentView === "approvals" && <ApprovalsView />}
            {currentView === "ai-health" && <AiHealthView />}
            {currentView === "compliance" && <ComplianceView />}
            {currentView === "publisher" && <CampaignPublisherView />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
