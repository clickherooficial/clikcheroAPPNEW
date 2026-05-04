-- Migration: Captain America hardening — remove SVG da whitelist de pipeline-assets
-- Spec: .kiro/specs/fury-learning/ (closeout 2026-05-02)
--
-- Razao: SVG carrega XSS via <script>/onerror se renderizado inline. Bucket privado
-- mitiga, mas nao ha caso de uso real pra SVG no pipeline (imagescript so processa
-- raster). Remover ate haver demanda + sanitizacao via DOMPurify.
--
-- Aditivo (so restringe). Nao ha rows existentes com mime_type='image/svg+xml'
-- (verificar antes de aplicar; se houver, decidir caso a caso).

-- 1) Atualizar CHECK constraint da tabela creative_assets
ALTER TABLE public.creative_assets
  DROP CONSTRAINT IF EXISTS creative_assets_mime_type_check;

ALTER TABLE public.creative_assets
  ADD CONSTRAINT creative_assets_mime_type_check
  CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp'));

-- 2) Atualizar allowed_mime_types do bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'pipeline-assets';
