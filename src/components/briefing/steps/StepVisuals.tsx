// Passo 5 — Identidade Visual. Spec: briefing-onboarding (task 6.6)

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBriefingAssets } from '@/hooks/use-briefing-assets';
import {
  BRIEFING_ASSET_MAX_BYTES,
  MOOD_BOARD_MAX_ITEMS,
  type AssetKind,
  type PaletteData,
} from '@/types/briefing';

interface Props {
  initial: PaletteData;
  disabled?: boolean;
  onSubmit: (palette: PaletteData) => void;
  onBack: () => void;
}

export function StepVisuals({ initial, disabled, onSubmit, onBack }: Props) {
  const { toast } = useToast();
  const { assets, upload, remove } = useBriefingAssets();
  const [busy, setBusy] = useState(false);
  const [primary, setPrimary] = useState(initial.primary ?? '#000000');
  const [secondary, setSecondary] = useState(initial.secondary ?? '#ffffff');
  const [accent, setAccent] = useState(initial.accent ?? '#3b82f6');
  const [background, setBackground] = useState(initial.background ?? '#0a0a0a');

  const logoPrimary = assets.find((a) => a.kind === 'logo_primary');
  const logoAlt = assets.find((a) => a.kind === 'logo_alt');
  const moodBoard = assets.filter((a) => a.kind === 'mood_board');

  const handleUpload = async (kind: AssetKind, file: File) => {
    setBusy(true);
    const result = await upload({ file, kind });
    setBusy(false);
    if (!result.ok) {
      const msg =
        result.error.kind === 'too_large'
          ? `Arquivo maior que ${(BRIEFING_ASSET_MAX_BYTES / 1024 / 1024).toFixed(0)}MB`
          : result.error.kind === 'unsupported_mime'
          ? 'Formato nao suportado (use png, jpg, webp ou svg)'
          : result.error.kind === 'mood_board_limit_reached'
          ? `Limite de ${MOOD_BOARD_MAX_ITEMS} imagens de referencia`
          : 'Erro ao enviar arquivo';
      toast({ title: 'Upload falhou', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LogoSlot
          label="Logo principal"
          asset={logoPrimary}
          onUpload={(f) => handleUpload('logo_primary', f)}
          onRemove={() => logoPrimary && remove(logoPrimary.id)}
          disabled={disabled || busy}
        />
        <LogoSlot
          label="Logo alternativa (fundo escuro)"
          asset={logoAlt}
          onUpload={(f) => handleUpload('logo_alt', f)}
          onRemove={() => logoAlt && remove(logoAlt.id)}
          disabled={disabled || busy}
        />
      </div>

      <div>
        <Label className="mb-2 block">Paleta de cores</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ColorField label="Primaria" value={primary} onChange={setPrimary} disabled={disabled} />
          <ColorField label="Secundaria" value={secondary} onChange={setSecondary} disabled={disabled} />
          <ColorField label="Destaque/CTA" value={accent} onChange={setAccent} disabled={disabled} />
          <ColorField label="Fundo" value={background} onChange={setBackground} disabled={disabled} />
        </div>
      </div>

      <div>
        <Label className="mb-1 block">Imagens de referencia ({moodBoard.length}/{MOOD_BOARD_MAX_ITEMS})</Label>
        <p className="text-xs text-muted-foreground mb-2">Anuncios, posts ou fotos que mostram o clima visual que voce quer para a marca.</p>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {moodBoard.map((m) => (
            <div key={m.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
              {m.signed_url ? (
                <img src={m.signed_url} alt="mood" className="object-cover w-full h-full" />
              ) : (
                <div className="flex items-center justify-center h-full"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
              )}
              <button
                type="button"
                className="absolute top-1 right-1 p-1 bg-background/80 rounded hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => remove(m.id)}
                disabled={disabled || busy}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {moodBoard.length < MOOD_BOARD_MAX_ITEMS && (
            <UploadButton onPick={(f) => handleUpload('mood_board', f)} disabled={disabled || busy} />
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={disabled || busy}>Voltar</Button>
        <Button
          disabled={disabled || busy}
          onClick={() => onSubmit({ primary, secondary, accent, background })}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

function LogoSlot({
  label,
  asset,
  onUpload,
  onRemove,
  disabled,
}: {
  label: string;
  asset?: { signed_url?: string; id: string };
  onUpload: (f: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <Label>{label}</Label>
        <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
          {asset?.signed_url ? (
            <img src={asset.signed_url} alt={label} className="object-contain max-h-full" />
          ) : (
            <span className="text-xs text-muted-foreground">Nenhum arquivo</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <Upload className="h-3 w-3 mr-1" /> Enviar
          </Button>
          {asset && (
            <Button size="sm" variant="ghost" onClick={onRemove} disabled={disabled}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UploadButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={disabled}
      className="aspect-square rounded-md border-2 border-dashed flex items-center justify-center hover:bg-muted disabled:opacity-50"
    >
      {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </button>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center mt-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-12 rounded border border-input cursor-pointer disabled:opacity-50"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="flex-1" />
      </div>
    </div>
  );
}
