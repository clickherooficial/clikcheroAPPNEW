# Tasks — agent-execution-loop

> Sprint 5/8.

## 1. Backend
- [x] 1.1 Migration `20260504000003_plan_execution.sql`
- [x] 1.2 Edge Fn `agent-plan-execute`
- [x] 1.3 Helper `_shared/plan-execute-handler.ts` (handler do tool)
- [ ] 1.4 Apply migration via Dashboard
- [ ] 1.5 Deploy Edge Fn

## 2. Tools
- [x] 2.1 Tool `execute_plan` em tools.ts
- [x] 2.2 Dispatcher case em ai-chat
- [x] 2.3 SYSTEM_PROMPT update

## 3. Frontend
- [x] 3.1 `src/types/plans.ts`
- [x] 3.2 `src/hooks/use-plans.ts` com realtime
- [x] 3.3 `src/components/plans/PlanCard.tsx`
- [x] 3.4 `src/components/PlansView.tsx`
- [x] 3.5 Sidebar + Index wire

## 4. Validacao
- [x] 4.1 Build verde
- [ ] 4.2 Captain review (transicao status atomica)
- [ ] 4.3 Hulk smoke
- [x] 4.4 Steering update
