import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import { TrendIndicator } from "./TrendIndicator";

interface KpiCardProps {
  label: string;
  value: string;
  /** Unidade pos-valor (ex: "x", "%"). Renderizada menor. */
  unit?: string;
  deltaPct: number | null;
  higherIsBetter?: boolean;
  hint?: string;
  icon?: LucideIcon;
  sparklineData?: number[];
  /** Cor destaque (default: primary/laranja). Use "text-emerald-500" etc. */
  accentClassName?: string;
  loading?: boolean;
}

/**
 * KpiCard Tier 1 — card grande com label, valor tabular display, trend e sparkline.
 * Visual hero para KPIs principais (ROAS, Lucro, Investimento).
 */
export function KpiCard({
  label,
  value,
  unit,
  deltaPct,
  higherIsBetter = true,
  hint = "vs período anterior",
  icon: Icon,
  sparklineData,
  accentClassName = "text-primary",
  loading = false,
}: KpiCardProps) {
  const hasSparkline = !!(sparklineData && sparklineData.length >= 2);
  return (
    <div className={cn("bento-card group h-full", hasSparkline && "pb-16")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <Icon className={cn("h-4 w-4", accentClassName)} strokeWidth={2.5} />
            </div>
          )}
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        {loading ? (
          <div className="h-10 w-28 skeleton rounded-xl bg-white/5" />
        ) : (
          <>
            <span className="text-4xl font-bold tracking-tighter text-foreground">
              {value}
            </span>
            {unit && (
              <span className="text-lg font-medium text-muted-foreground">{unit}</span>
            )}
          </>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="h-4 w-20 skeleton rounded bg-white/5" />
        ) : (
          <TrendIndicator deltaPct={deltaPct} higherIsBetter={higherIsBetter} hint={hint} />
        )}
      </div>

      {hasSparkline && (
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
          <Sparkline
            data={sparklineData}
            strokeClassName={accentClassName}
            fillClassName={accentClassName}
            height={64}
          />
        </div>
      )}
    </div>
  );
}
