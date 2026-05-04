import { MessageSquare, BarChart3, ImagePlus, Brain, ShieldAlert, Plug, Activity, Rocket, ShieldCheck, Sparkles, Shield, Sliders, Users, ListChecks, Package, GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/auth/OrganizationSwitcher";
import { UserMenu } from "@/components/auth/UserMenu";
import { Logo } from "@/components/shared/Logo";
import { useCreativeUsage } from "@/hooks/use-creative-usage";
import { useSafetyStatus } from "@/hooks/use-safety";

type View = "chat" | "painel" | "criativos" | "cerebro" | "approvals" | "ai-health" | "compliance" | "publisher" | "safety" | "optimization" | "audiences" | "plans" | "catalogs" | "ab-tests";

interface AppSidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

// 5 itens principais — sidebar enxuta com nomes em linguagem de usuario
const navItems: { id: View; label: string; icon: React.ElementType; helper?: string }[] = [
  { id: "chat", label: "Meus anúncios", icon: MessageSquare, helper: "Chat e ações para seus anúncios" },
  { id: "painel", label: "Painel", icon: BarChart3, helper: "KPIs, análise e orçamento" },
  { id: "criativos", label: "Criativos", icon: ImagePlus, helper: "Anúncios criados pela IA e da Meta" },
  { id: "cerebro", label: "Configurações", icon: Brain, helper: "Regras, memória e identidade" },
  { id: "approvals", label: "Aprovações", icon: ShieldAlert, helper: "Ações pendentes de aprovação" },
];

// Itens secundarios (footer)
const secondaryItems: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "publisher", label: "Publicar campanha", icon: Rocket },
  { id: "optimization", label: "Otimização", icon: Sliders },
  { id: "audiences", label: "Audiências", icon: Users },
  { id: "plans", label: "Planos", icon: ListChecks },
  { id: "catalogs", label: "Catálogos", icon: Package },
  { id: "ab-tests", label: "A/B Tests", icon: GitBranch },
  { id: "safety", label: "Segurança do agente", icon: Shield },
];

function usePendingApprovalsCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('approvals' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (mounted) setCount(c ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel('approvals-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, () => fetchCount())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, []);
  return count;
}

function useAiHealthDot(): { color: 'green' | 'yellow' | 'red'; tooltip: string } {
  const { health, isLoading } = useCreativeUsage();
  if (isLoading) return { color: 'green', tooltip: 'Carregando saúde do AI...' };

  // Total de runs nas ultimas 24h por provedor
  const nanoTotal = health.nano_banana_24h.success + health.nano_banana_24h.failed;
  const gptTotal = health.gpt_image_24h.success + health.gpt_image_24h.failed;
  const totalRuns = nanoTotal + gptTotal;

  if (totalRuns === 0) {
    return { color: 'green', tooltip: 'Sem gerações nas últimas 24h.' };
  }

  const totalFailed = health.nano_banana_24h.failed + health.gpt_image_24h.failed;
  const failRatio = totalFailed / totalRuns;
  const p95s = (health.p95_latency_ms ?? 0) / 1000;

  if (failRatio >= 0.5 || p95s > 90) {
    return { color: 'red', tooltip: `Saúde crítica: ${Math.round(failRatio * 100)}% falhas, p95 ${p95s.toFixed(1)}s` };
  }
  if (failRatio >= 0.2 || p95s > 45) {
    return { color: 'yellow', tooltip: `Atenção: ${Math.round(failRatio * 100)}% falhas, p95 ${p95s.toFixed(1)}s` };
  }
  return { color: 'green', tooltip: `OK — ${Math.round((1 - failRatio) * 100)}% sucesso, p95 ${p95s.toFixed(1)}s` };
}

const AppSidebar = ({ currentView, onViewChange }: AppSidebarProps) => {
  const navigate = useNavigate();
  const pendingApprovals = usePendingApprovalsCount();
  const health = useAiHealthDot();
  const { data: safetyStatus } = useSafetyStatus();
  const safetyPaused = safetyStatus?.is_paused ?? false;

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl md:w-[240px] xl:w-[260px]">
      <div className="shrink-0">
        <div className="px-6 pb-2 pt-8">
          <div className="hover-lift cursor-pointer transition-all duration-300">
            <Logo size="md" />
          </div>
        </div>
        <div className="px-4 py-4">
          <OrganizationSwitcher />
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={() => onViewChange("chat")}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            <span>Agente HERO</span>
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                title={item.helper}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.id === "approvals" && pendingApprovals > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold border border-amber-500/40">
                    {pendingApprovals}
                  </span>
                )}
                {active && !(item.id === "approvals" && pendingApprovals > 0) && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground opacity-50">
          Secundarios
        </div>
        <div className="space-y-1">
          {secondaryItems.map((item) => {
            const active = currentView === item.id;
            const showSafetyDot = item.id === "safety" && safetyPaused;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-sidebar-foreground/50")} />
                <span className="truncate">{item.label}</span>
                {showSafetyDot && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" title="Agente pausado" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-1 border-t border-sidebar-border p-4">
        <button
          onClick={() => onViewChange("ai-health")}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          title={health.tooltip}
        >
          <Activity className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          <span className="truncate">Saúde do AI</span>
          <span
            className={cn(
              'ml-auto h-1.5 w-1.5 rounded-full',
              health.color === 'green' && 'bg-emerald-500',
              health.color === 'yellow' && 'bg-amber-500',
              health.color === 'red' && 'bg-red-500',
            )}
          />
        </button>
        <button
          onClick={() => navigate('/integrations')}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
        >
          <Plug className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          <span className="truncate">Integrações</span>
        </button>
        <UserMenu />
      </div>
    </aside>
  );
};

export default AppSidebar;
