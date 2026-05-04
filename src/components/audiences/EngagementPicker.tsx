// pixel-engagement-audiences (Sprint 4/8) — UI builder pra Engagement Audience.
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudienceSources } from '@/hooks/use-audience-sources';
import type {
  CreateEngagementAudiencePayload,
  EngagementSourceKind,
  EngagementTemplate,
} from '@/types/pixel-audiences';

const TEMPLATES_BY_KIND: Record<EngagementSourceKind, { value: EngagementTemplate; label: string }[]> = {
  page: [
    { value: 'page_engaged_users', label: 'Engajou com pagina (curtiu, comentou, salvou)' },
    { value: 'page_visitors', label: 'Visitou pagina' },
  ],
  ig_business: [
    { value: 'page_engaged_users', label: 'Engajou com IG' },
    { value: 'page_visitors', label: 'Visitou perfil IG' },
  ],
  video: [
    { value: 'video_viewers_25_pct', label: 'Viu 25% do video' },
    { value: 'video_viewers_50_pct', label: 'Viu 50% do video' },
    { value: 'video_viewers_75_pct', label: 'Viu 75% do video' },
    { value: 'video_viewers_95_pct', label: 'Viu 95% do video' },
    { value: 'video_viewers_3_seconds', label: 'Viu 3s do video' },
    { value: 'video_viewers_10_seconds', label: 'Viu 10s do video' },
  ],
  lead_form: [
    { value: 'lead_form_opened', label: 'Abriu formulario' },
    { value: 'lead_form_submitted', label: 'Submeteu formulario' },
  ],
  event: [
    { value: 'event_responded', label: 'Respondeu ao evento' },
    { value: 'event_attended', label: 'Compareceu ao evento' },
  ],
};

interface Props {
  value: CreateEngagementAudiencePayload | null;
  onChange: (v: CreateEngagementAudiencePayload | null) => void;
}

export function EngagementPicker({ value, onChange }: Props) {
  const { data: sources = [] } = useAudienceSources();

  const [name, setName] = useState(value?.name ?? '');
  const [sourceKind, setSourceKind] = useState<EngagementSourceKind>(value?.source_kind ?? 'page');
  const [sourceId, setSourceId] = useState(value?.source_id ?? '');
  const [template, setTemplate] = useState<EngagementTemplate>(value?.template ?? 'page_engaged_users');
  const [retentionDays, setRetentionDays] = useState<number>(value?.retention_days ?? 180);

  const sourcesOfKind = useMemo(() => sources.filter((s) => s.kind === sourceKind), [sources, sourceKind]);
  const availableTemplates = TEMPLATES_BY_KIND[sourceKind];

  useEffect(() => {
    const valid = name && sourceId;
    if (!valid) { onChange(null); return; }
    onChange({
      name,
      source_kind: sourceKind,
      source_id: sourceId,
      template,
      retention_days: retentionDays,
    });
  }, [name, sourceKind, sourceId, template, retentionDays, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome da audiencia</Label>
        <Input
          placeholder='Ex: "Viu 75% video lancamento"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de fonte</Label>
          <Select value={sourceKind} onValueChange={(v) => {
            setSourceKind(v as EngagementSourceKind);
            setSourceId('');
            setTemplate(TEMPLATES_BY_KIND[v as EngagementSourceKind][0].value);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="page">Página FB</SelectItem>
              <SelectItem value="ig_business">Instagram Business</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="lead_form">Lead Form</SelectItem>
              <SelectItem value="event">Evento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Retencao (dias, max 365)</Label>
          <Input
            type="number" min={1} max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Fonte específica</Label>
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger>
            <SelectValue placeholder={sourcesOfKind.length === 0 ? 'Nenhuma fonte sincronizada' : 'Escolha'} />
          </SelectTrigger>
          <SelectContent>
            {sourcesOfKind.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Sincronize as fontes no painel primeiro.
              </div>
            )}
            {sourcesOfKind.map((s) => (
              <SelectItem key={s.id} value={s.external_id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Template</Label>
        <Select value={template} onValueChange={(v) => setTemplate(v as EngagementTemplate)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableTemplates.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
