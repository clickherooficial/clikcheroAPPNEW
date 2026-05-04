// Passo 1 do wizard — Negocio. Spec: briefing-onboarding (task 6.2)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CompanyBriefing } from '@/types/briefing';

interface StepBusinessProps {
  initial: CompanyBriefing | null;
  disabled?: boolean;
  mode?: 'wizard' | 'settings';
  onSubmit: (data: {
    niche: string;
    niche_category?: string;
    short_description: string;
    website_url?: string;
    social_links: { instagram?: string; facebook?: string; tiktok?: string };
  }) => void;
}

export function StepBusiness({ initial, disabled, mode = 'wizard', onSubmit }: StepBusinessProps) {
  const [niche, setNiche] = useState(initial?.niche ?? '');
  const [category, setCategory] = useState(initial?.niche_category ?? '');
  const [description, setDescription] = useState(initial?.short_description ?? '');
  const [website, setWebsite] = useState(initial?.website_url ?? '');
  const [instagram, setInstagram] = useState(initial?.social_links?.instagram ?? '');
  const [facebook, setFacebook] = useState(initial?.social_links?.facebook ?? '');
  const [tiktok, setTiktok] = useState(initial?.social_links?.tiktok ?? '');

  const canSubmit = niche.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="niche">Nicho / Segmento *</Label>
        <Input
          id="niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Ex: Ecommerce de moda feminina"
          disabled={disabled}
          maxLength={120}
        />
      </div>

      <div>
        <Label htmlFor="category">Categoria (opcional)</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Ex: Saúde / Educacao / Serviços"
          disabled={disabled}
          maxLength={60}
        />
      </div>

      <div>
        <Label htmlFor="description">Descrição curta da empresa *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Em 1-3 frases: o que sua empresa faz e para quem"
          disabled={disabled}
          maxLength={280}
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">{description.length}/280</p>
      </div>

      <div>
        <Label htmlFor="website">Site / Landing page</Label>
        <Input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="ig">Instagram</Label>
          <Input
            id="ig"
            type="text"
            inputMode="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@usuário ou link do perfil"
            disabled={disabled}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
            Aceita @usuário, usuário ou URL completa; normalizamos o link automaticamente.
          </p>
        </div>
        <div>
          <Label htmlFor="fb">Facebook</Label>
          <Input id="fb" type="url" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." disabled={disabled} />
        </div>
        <div>
          <Label htmlFor="tt">TikTok</Label>
          <Input
            id="tt"
            type="text"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="@usuário ou link"
            disabled={disabled}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          disabled={!canSubmit || disabled}
          onClick={() =>
            onSubmit({
              niche: niche.trim(),
              niche_category: category.trim() || undefined,
              short_description: description.trim(),
              website_url: website.trim() || undefined,
              social_links: {
                instagram: instagram.trim() || undefined,
                facebook: facebook.trim() || undefined,
                tiktok: tiktok.trim() || undefined,
              },
            })
          }
        >
          {mode === 'settings' ? 'Salvar alteracoes' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
