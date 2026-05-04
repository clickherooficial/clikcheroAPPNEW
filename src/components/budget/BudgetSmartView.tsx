import { Wallet } from 'lucide-react';
import { GoalWizard } from './GoalWizard';

export default function BudgetSmartView() {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 xl:p-8 space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Orçamento Smart</h1>
            <p className="text-sm text-muted-foreground">A IA pensa na distribuicao do seu orçamento</p>
          </div>
        </div>

        <GoalWizard />

        <p className="text-xs text-muted-foreground text-center pt-4">
          Projecoes baseadas em histórico. Resultados reais podem variar.
        </p>
      </div>
    </div>
  );
}
