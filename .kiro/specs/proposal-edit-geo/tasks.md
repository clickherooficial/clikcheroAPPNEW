# Tasks — proposal-edit-geo

> Status: APPROVED (fast-track)

- [x] 1. Criar Edge Function `supabase/functions/meta-geo-search/index.ts` (POST + tenant guard + Zod + decrypt token + `searchMetaAdGeoCity` + JSON response).
- [x] 2. Criar hook `src/hooks/use-meta-geo-search.ts` (useMutation + mapEdgeError).
- [x] 3. Atualizar `src/components/chat/CampaignProposalEditor.tsx`: adicionar campo "Localidade", integrar resolveCity no Save, exibir toast em erro.
- [x] 4. `npm run build` verde.
- [x] 5. Atualizar `.kiro/steering/implemented-features.md`.
- [x] 6. Commit + push (origin + clickhero) — deploy da edge fn requer autorização explícita do usuário.
