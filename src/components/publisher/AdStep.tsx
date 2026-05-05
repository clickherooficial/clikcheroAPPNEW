import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdData {
  name: string;
  headline: string;
  body: string;
  description?: string;
  cta: string;
  image_url?: string;
  video_url?: string;
  link_url: string;
  page_id: string;
  pixel_id?: string;
}

const CTAS: Record<string, string> = {
  LEARN_MORE: 'Saiba Mais',
  SHOP_NOW: 'Comprar Agora',
  SIGN_UP: 'Cadastre-se',
  SUBSCRIBE: 'Inscreva-se',
  DOWNLOAD: 'Baixar',
  CONTACT_US: 'Entre em Contato',
  GET_OFFER: 'Aproveitar Oferta',
  BOOK_NOW: 'Reservar',
};

interface Props {
  data: AdData;
  onChange: (d: AdData) => void;
}

export function AdStep({ data, onChange }: Props) {
  const set = <K extends keyof AdData>(k: K, v: AdData[K]) => onChange({ ...data, [k]: v });

  // Load Facebook pages para dropdown
  const { data: pages } = useQuery<Array<{ page_id: string; page_name: string | null }>>({
    queryKey: ['meta-pages-for-publish'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_pages' as any)
        .select('page_id, page_name')
        .is('deleted_at', null) as any;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Página Facebook *</Label>
        <Select value={data.page_id} onValueChange={(v) => set('page_id', v)}>
          <SelectTrigger>
            <SelectValue placeholder={pages && pages.length === 0 ? 'Nenhuma página conectada — va em Integrações' : 'Selecione a página'} />
          </SelectTrigger>
          <SelectContent>
            {(pages ?? []).map((p) => (
              <SelectItem key={p.page_id} value={p.page_id}>{p.page_name ?? p.page_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Todos anúncios Meta precisam estar vinculados a uma página do Facebook.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Nome Interno do Anúncio *</Label>
        <Input value={data.name} onChange={(e) => set('name', e.target.value)} maxLength={400} placeholder="Ex: Convite-lancamento-colecao-marco" />
      </div>

      <div className="space-y-1.5">
        <Label>Headline * ({data.headline.length}/40)</Label>
        <Input value={data.headline} onChange={(e) => set('headline', e.target.value)} maxLength={40} placeholder="Frase principal do anúncio" />
      </div>

      <div className="space-y-1.5">
        <Label>Texto Principal * ({data.body.length}/125)</Label>
        <Textarea value={data.body} onChange={(e) => set('body', e.target.value)} maxLength={125} rows={3} placeholder="Descrição do anúncio" />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição (opcional) ({(data.description ?? '').length}/27)</Label>
        <Input value={data.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={27} placeholder="Texto curto complementar" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Call-to-Action</Label>
          <Select value={data.cta} onValueChange={(v) => set('cta', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CTAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>URL de Destino *</Label>
          <Input
            type="url"
            value={data.link_url}
            onChange={(e) => set('link_url', e.target.value)}
            placeholder="https://exemplo.com/promoção"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>URL da Imagem (opcional)</Label>
        <Input
          type="url"
          value={data.image_url ?? ''}
          onChange={(e) => set('image_url', e.target.value || undefined)}
          placeholder="https://exemplo.com/criativo.jpg"
        />
        {data.image_url && (
          <img src={data.image_url} alt="Preview" className="mt-2 max-h-40 rounded border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        🛡️ Antes da públicação, o compliance engine analisara copy e imagem com IA pra detectar violacoes das politicas Meta.
      </div>
    </div>
  );
}
