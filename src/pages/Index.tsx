import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { BriefingCompletenessBanner } from "@/components/briefing/BriefingCompletenessBanner";
import { useBriefingCompleteness } from "@/hooks/use-briefing-completeness";
import { useAuth } from "@/hooks/use-auth";
import ChatView from "@/components/ChatView";
import PainelView from "@/components/PainelView";
import CriativosView from "@/components/CriativosView";
import CerebroFuryView from "@/components/CerebroFuryView";
import ApprovalsView from "@/components/ApprovalsView";
import AiHealthView from "@/components/AiHealthView";
import ComplianceView from "@/components/compliance/ComplianceView";
import CampaignPublisherView from "@/components/publisher/CampaignPublisherView";
import SafetyView from "@/components/SafetyView";
import OptimizationView from "@/components/OptimizationView";
import AudiencesView from "@/components/AudiencesView";
import PlansView from "@/components/PlansView";
import CatalogsView from "@/components/CatalogsView";
import ABTestsView from "@/components/ABTestsView";
import { AdAccountSwitcher } from "@/components/auth/AdAccountSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { onNavigateToView } from "@/lib/view-navigation";

// Sidebar consolidada (5 itens principais + 3 footer/secundarios + safety)
type View = "chat" | "painel" | "criativos" | "cerebro" | "approvals" | "ai-health" | "compliance" | "publisher" | "safety" | "optimization" | "audiences" | "plans" | "catalogs" | "ab-tests";

const viewTitles: Record<View, string> = {
  chat: "Meus anúncios",
  painel: "Painel",
  criativos: "Criativos",
  cerebro: "Configurações",
  approvals: "Aprovações",
  "ai-health": "Saúde do AI",
  compliance: "Compliance",
  publisher: "Publicar Campanha",
  safety: "Segurança do Agente",
  optimization: "Otimização",
  audiences: "Audiências",
  plans: "Planos",
  catalogs: "Catálogos",
  "ab-tests": "A/B Tests",
};

const VIEW_STORAGE_KEY = "clickhero:currentView";
const VALID_VIEWS: View[] = ["chat", "painel", "criativos", "cerebro", "approvals", "ai-health", "compliance", "publisher", "safety", "optimization", "audiences", "plans", "catalogs", "ab-tests"];

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
  const { company } = useAuth();
  const { status: briefingStatus, score: briefingScore, isLoading: briefingLoading } = useBriefingCompleteness();

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
  // Auto-redirect ao wizard so dispara quando:
  //  - company ja carregou (evita race com auth, que deixa o hook em DEFAULT_STATE)
  //  - briefing nunca foi tocado: status='not_started' E score=0 (a view e fonte da
  //    verdade; protege contra trigger refresh_briefing_status falhar e travar status)
  //  - usuario nao pediu pra pular
  const briefingTrulyEmpty =
    briefingStatus === 'not_started' && briefingScore === 0;
  if (!briefingLoading && company?.id && briefingTrulyEmpty && !hasSkipped) {
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
            <AdAccountSwitcher />
            <ThemeToggle />
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
            {currentView === "safety" && <SafetyView />}
            {currentView === "optimization" && <OptimizationView />}
            {currentView === "audiences" && <AudiencesView />}
            {currentView === "plans" && <PlansView />}
            {currentView === "catalogs" && <CatalogsView />}
            {currentView === "ab-tests" && <ABTestsView />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
