import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useComplianceViolations, type ComplianceScore } from '@/hooks/use-compliance';
import { AlertTriangle, XCircle, Info, Loader2 } from 'lucide-react';

const SEVERITY_STYLES: Record<string, { className: string; Icon: typeof Info }> = {
  info: { className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', Icon: Info },
  warning: { className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: AlertTriangle },
  critical: { className: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  blacklist_term: 'Termo proibido',
  misleading_language: 'Linguagem enganosa',
  unfulfillable_promise: 'Promessa impossivel',
  meta_policy_violation: 'Politica Meta',
  visual_claim: 'Claim visual',
  brand_mismatch: 'Marca inconsistente',
  ocr_text_violation: 'Texto em imagem',
};

interface Props {
  score: ComplianceScore;
  onClose: () => void;
}

export function ComplianceDetail({ score, onClose }: Props) {
  const { data: violations, isLoading } = useComplianceViolations(score.id);

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {score.creative_image_url && (
              <img src={score.creative_image_url} alt="" className="w-12 h-12 rounded object-cover" />
            )}
            <div>
              <div className="text-base">{score.creative_name ?? 'Anúncio'}</div>
              <div className="text-xs text-muted-foreground font-normal">{score.external_ad_id}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Score summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{score.final_score}</div>
              <div className="text-xs text-muted-foreground">Final</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{score.copy_score ?? '—'}</div>
              <div className="text-xs text-muted-foreground">Copy</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{score.image_score ?? '—'}</div>
              <div className="text-xs text-muted-foreground">Visual</div>
            </div>
          </div>

          <Separator />

          {/* Violations */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Violacoes {violations ? `(${violations.length})` : ''}
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !violations || violations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma violacao encontrada. Anúncio conforme!
              </div>
            ) : (
              <div className="space-y-3">
                {violations.map((v) => {
                  const style = SEVERITY_STYLES[v.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <div key={v.id} className="p-3 rounded-lg border bg-card space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge className={`${style.className} border text-xs`}>
                          <style.Icon className="w-3 h-3 mr-1" />
                          {TYPE_LABELS[v.violation_type] ?? v.violation_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">-{v.points_deducted} pts</span>
                      </div>
                      <p className="text-sm">{v.description}</p>
                      {v.evidence && (
                        <p className="text-xs text-muted-foreground italic">"{v.evidence}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
