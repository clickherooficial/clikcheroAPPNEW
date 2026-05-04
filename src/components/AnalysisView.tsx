import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";

interface Insight {
  id: string;
  type: "success" | "warning" | "tip";
  title: string;
  description: string;
  metric?: string;
  change?: string;
  positive?: boolean;
}

const insights: Insight[] = [
  {
    id: "1",
    type: "success",
    title: "ROAS acima da meta",
    description: "A campanha 'Conversão — Produto A' atingiu ROAS de 5.2x, superando a meta de 4.0x. Considere escalar o orçamento.",
    metric: "5.2x ROAS",
    change: "+30%",
    positive: true,
  },
  {
    id: "2",
    type: "warning",
    title: "Fadiga de criativo detectada",
    description: "O criativo 'Reels Testimonial' teve queda de 35% no CTR nos últimos 3 dias. Recomendamos testar novas variações.",
    metric: "2.1% CTR",
    change: "-35%",
    positive: false,
  },
  {
    id: "3",
    type: "tip",
    title: "Oportunidade de público",
    description: "O público Lookalike 1% tem CPA 38% menor que a media. Considere criar novas campanhas segmentando este público.",
    metric: "R$ 22.30 CPA",
    change: "-38%",
    positive: true,
  },
  {
    id: "4",
    type: "success",
    title: "Melhor horario identificado",
    description: "Suas campanhas performam 45% melhor entre 19h-22h. Os anúncios agendados neste horario geram mais conversões.",
    metric: "19h-22h",
    change: "+45%",
    positive: true,
  },
  {
    id: "5",
    type: "warning",
    title: "Budget não consumido",
    description: "A campanha 'Awareness — Marca' consumiu apenas 60% do orçamento diario. Verifique a segmentacao de público.",
    metric: "60%",
    change: "-40%",
    positive: false,
  },
];

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  tip: Lightbulb,
};

const styleMap = {
  success: { border: "border-l-emerald-500", bg: "bg-emerald-50", icon: "text-emerald-600" },
  warning: { border: "border-l-amber-500", bg: "bg-amber-50", icon: "text-amber-600" },
  tip: { border: "border-l-blue-500", bg: "bg-blue-50", icon: "text-blue-600" },
};

const funnelSteps = [
  { label: "Impressoes", value: "245.8K", pct: 100 },
  { label: "Cliques", value: "8.4K", pct: 34 },
  { label: "Visitas LP", value: "6.1K", pct: 25 },
  { label: "Add to Cart", value: "1.2K", pct: 10 },
  { label: "Conversões", value: "312", pct: 5 },
];

const AnalysisView = () => {
  return (
    <div className="mx-auto h-full max-w-[1600px] animate-fade-in space-y-6 overflow-y-auto p-4 md:p-6 xl:p-8">
      <PageHeader
        title="Análise"
        description="Insights e recomendações baseados em dados das suas campanhas"
      />

      {/* Funnel */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-e1">
        <h3 className="mb-5 text-sm font-semibold tracking-tight text-foreground">Funil de Conversão</h3>
        <div className="flex h-48 items-end gap-3">
          {funnelSteps.map((step, i) => (
            <div key={step.label} className="flex flex-1 flex-col items-center gap-2">
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{step.value}</p>
              <div
                className="w-full rounded-lg bg-[linear-gradient(135deg,#cf6f03_0%,#e8850a_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] transition-all"
                style={{ height: `${step.pct}%`, opacity: Math.max(0.3, 1 - i * 0.13) }}
              />
              <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{step.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Insights Automaticos</h3>
        {insights.map((insight) => {
          const Icon = iconMap[insight.type];
          const style = styleMap[insight.type];
          return (
            <div
              key={insight.id}
              className={cn(
                "animate-slide-up rounded-xl border border-border/60 bg-card p-4 shadow-e1 transition-shadow duration-base ease-smooth hover:shadow-e2",
                "border-l-[3px]",
                style.border,
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.bg)}>
                  <Icon className={cn("h-4 w-4", style.icon)} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{insight.title}</p>
                    {insight.metric && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{insight.metric}</span>
                        {insight.change && (
                          <span className={cn(
                            "flex items-center gap-0.5 font-mono text-[11px] font-medium tabular-nums",
                            insight.positive ? "text-emerald-600" : "text-red-600",
                          )}>
                            {insight.positive ? <TrendingUp className="h-3 w-3" strokeWidth={2.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.5} />}
                            {insight.change}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnalysisView;
