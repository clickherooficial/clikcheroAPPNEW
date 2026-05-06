# Requirements — proposal-edit-geo

> Status: APPROVED (fast-track)
> Owner: Iron Man + Thor

## Contexto
O modal `Editar proposta` (CampaignProposalEditor) hoje permite editar orçamento, idade, copy e CTA, mas **não** permite editar a localidade do targeting. A propósta carrega `audience.geo_locations` resolvido na criação (briefing/conversa), e mudar a localidade exige cancelar e refazer a proposta.

## Requirements (EARS)

- **R1.** WHEN o usuário abre o modal `CampaignProposalEditor`, the system SHALL exibir um campo de texto "Localidade" pré-preenchido com `audience_geo_summary` (ou texto derivado de `geo_locations` quando ausente).
- **R2.** WHEN o usuário deixa o campo "Localidade" vazio e salva, the system SHALL preservar a `geo_locations` existente (no-op para esse campo).
- **R3.** WHEN o usuário digita uma cidade (ex: "Belo Horizonte" ou "Belo Horizonte, MG") e clica Salvar, the system SHALL chamar a Edge Function `meta-geo-search` que resolve via Meta Targeting Search API para um city key Meta válido.
- **R4.** WHEN o resolver retorna sucesso, the system SHALL atualizar `audience.geo_locations.cities = [{key, radius: 25, distance_unit: 'kilometer'}]` e `audience_geo_summary = "<Cidade> e regiao (~25 km)"` na proposta (merge com outros patches do form).
- **R5.** WHEN o resolver não encontra cidade, the system SHALL bloquear o save e mostrar toast `destructive` com mensagem "Não encontramos essa localidade no Meta. Tente 'Cidade, UF'." sem perder os outros campos editados.
- **R6.** WHEN o resolver retorna erro de rede/auth/token, the system SHALL mostrar toast com a causa e bloquear o save.
- **R7.** A Edge Function `meta-geo-search` SHALL exigir tenant guard (`requireTenant`), buscar o token Meta via `integrations` + `decrypt_meta_token`, e retornar `{ key, name, summary }` ou erro estruturado (`{ error: 'not_found' | 'no_meta_connection' | 'meta_api' | 'validation' }`).
- **R8.** O hook `useMetaGeoSearch` SHALL ser uma `useMutation` que invoca a edge fn e retorna `Result<{key, name, summary}, {kind, message}>`.

## Out of scope
- Autocomplete em tempo real enquanto digita (futuro).
- Edição de raio (radius) ou múltiplas cidades (futuro).
- Suporte a regiões/estados/países (apenas city por enquanto).

## Acceptance
- Build verde.
- Salvar com cidade válida muda `geo_locations.cities` e `audience_geo_summary` no banco.
- Salvar com cidade inválida mostra toast e mantém o modal aberto.
- Salvar sem mexer no campo não dispara request à Meta.
