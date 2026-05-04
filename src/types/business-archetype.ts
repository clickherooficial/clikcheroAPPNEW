// Tipos do dominio business-archetype-personas.
// Spec: .kiro/specs/business-archetype-personas/
// Define o enum de arquetipos de negocio usado em company_briefings.business_archetype
// e helpers de label/descricao para a UI de Settings + validacao runtime.

export type Archetype =
  | 'small_local_business'
  | 'online_seller'
  | 'service_provider'
  | 'info_product';

export const ARCHETYPE_VALUES: readonly Archetype[] = [
  'small_local_business',
  'online_seller',
  'service_provider',
  'info_product',
] as const;

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  small_local_business: 'Negócio local (loja física, restaurante, salão)',
  online_seller: 'Loja online (e-commerce, vendas pela internet)',
  service_provider: 'Prestador de serviço (consultoria, agência, autônomo)',
  info_product: 'Infoproduto (curso, mentoria, ebook)',
};

export const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
  small_local_business:
    'Você atende clientes presencialmente em um endereço físico e depende de movimento na região.',
  online_seller:
    'Você vende produtos físicos pela internet e o pedido é enviado pelos correios ou transportadora.',
  service_provider:
    'Você vende seu tempo ou expertise — o cliente contrata um trabalho que você executa.',
  info_product:
    'Você vende conhecimento empacotado em formato digital — curso, treinamento, comunidade ou material.',
};

export function isArchetype(value: unknown): value is Archetype {
  return (
    typeof value === 'string' &&
    (ARCHETYPE_VALUES as readonly string[]).includes(value)
  );
}
