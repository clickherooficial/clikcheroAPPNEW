import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MetaAssetPicker } from './MetaAssetPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function MetaAssetPickerModal({ open, onOpenChange, onComplete }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50">
          <DialogTitle>Selecione seus ativos Meta</DialogTitle>
          <DialogDescription>
            Escolha as Business Managers, contas de anúncio e páginas do Facebook que deseja conectar.
            Todos os dados do app (Dashboard, FURY, Compliance) virao dessas contas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden px-6 pb-4">
          <MetaAssetPicker
            onComplete={() => {
              onComplete();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
