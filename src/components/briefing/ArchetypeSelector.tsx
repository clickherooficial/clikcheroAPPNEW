// Componente de selecao manual do arquetipo do negocio (Cerebro/Briefing).
// Spec: business-archetype-personas (task 7.2)
// Auto-conectado via useBriefing — sem props.

import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBriefing } from '@/hooks/use-briefing';
import {
  ARCHETYPE_DESCRIPTIONS,
  ARCHETYPE_LABELS,
  ARCHETYPE_VALUES,
  type Archetype,
} from '@/types/business-archetype';

// Sentinel string usada no Select shadcn (nao aceita "" como valor valido).
// Convertida para null antes de chamar updateArchetype.
const NULL_SENTINEL = '__null__';
const NULL_LABEL = 'Nao sei / Misto';
const NULL_DESCRIPTION =
  'Sem arquetipo definido — sugestoes genericas (padrao).';

export function ArchetypeSelector() {
  const { briefing, isReadOnly, updateArchetype, isUpdatingArchetype } =
    useBriefing();

  const currentValue: string =
    briefing?.business_archetype ?? NULL_SENTINEL;

  const description =
    currentValue === NULL_SENTINEL
      ? NULL_DESCRIPTION
      : ARCHETYPE_DESCRIPTIONS[currentValue as Archetype];

  const handleChange = (value: string) => {
    const parsed: Archetype | null =
      value === NULL_SENTINEL ? null : (value as Archetype);
    updateArchetype(parsed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arquetipo do negocio</CardTitle>
        <CardDescription>
          Personaliza sugestoes de campanha e respostas do Fury.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Select
            value={currentValue}
            onValueChange={handleChange}
            disabled={isReadOnly || isUpdatingArchetype}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o arquetipo" />
            </SelectTrigger>
            <SelectContent>
              {ARCHETYPE_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ARCHETYPE_LABELS[value]}
                </SelectItem>
              ))}
              <SelectItem value={NULL_SENTINEL}>{NULL_LABEL}</SelectItem>
            </SelectContent>
          </Select>
          {isUpdatingArchetype && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
