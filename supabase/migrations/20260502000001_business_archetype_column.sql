-- Migration: business-archetype-personas — Task 1.1
-- Spec: .kiro/specs/business-archetype-personas/
--
-- Adiciona business_archetype em company_briefings. Aditivo, nullable, sem default.
-- Rows existentes ficam NULL (preserva comportamento Fase 1 — fallback genérico).
--
-- Os 4 valores fixos sao curados (research R-06): cobrem 80%+ dos casos reais
-- de pequenos anunciantes brasileiros. NULL = "nao classificado / misto".
--
-- Sem index extra: cardinalidade baixa (4 valores) e queries sao sempre por
-- company_id (PK). Index nao agregaria valor.

ALTER TABLE public.company_briefings
  ADD COLUMN IF NOT EXISTS business_archetype text
    CHECK (
      business_archetype IS NULL OR business_archetype IN (
        'small_local_business',
        'online_seller',
        'service_provider',
        'info_product'
      )
    );

COMMENT ON COLUMN public.company_briefings.business_archetype IS
  'Arquetipo de negocio (4 valores fixos + NULL). Detectado via archetype-detector edge fn ou setado manualmente em Settings. NULL = fallback generico (comportamento Fase 1). Valores: small_local_business | online_seller | service_provider | info_product.';
