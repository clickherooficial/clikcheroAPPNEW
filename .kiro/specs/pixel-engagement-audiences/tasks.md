# Tasks — pixel-engagement-audiences

> Sprint 4/8. Fast-track overnight.

## 1. Backend
- [x] 1.1 Migration `supabase/migrations/20260504000002_audience_sources_cache.sql`
- [x] 1.2 Helper `supabase/functions/_shared/audience-rule-builder.ts`
- [ ] 1.3 Apply migration via Dashboard

## 2. Edge Functions
- [x] 2.1 `meta-list-audience-sources` — fetch pixels/pages/IG/videos/lead_forms + cache
- [x] 2.2 `meta-audience-create-rule` — pixel + engagement audience via discriminated union
- [ ] 2.3 Deploy via CLI

## 3. Tools
- [x] 3.1 `create_pixel_audience` em tools.ts
- [x] 3.2 `create_engagement_audience` em tools.ts
- [x] 3.3 Handlers em audience-tool-handlers.ts
- [x] 3.4 Dispatcher cases em ai-chat
- [x] 3.5 SYSTEM_PROMPT atualizado

## 4. Frontend
- [x] 4.1 `src/types/pixel-audiences.ts`
- [x] 4.2 `src/hooks/use-audience-sources.ts`
- [x] 4.3 `src/components/audiences/PixelRuleBuilder.tsx`
- [x] 4.4 `src/components/audiences/EngagementPicker.tsx`
- [x] 4.5 Atualizar `CreateAudienceDialog` — destravar Pixel tab + adicionar Engagement tab

## 5. Validacao
- [x] 5.1 Build verde
- [ ] 5.2 Captain review
- [ ] 5.3 Hulk smoke E2E
- [x] 5.4 Steering update
