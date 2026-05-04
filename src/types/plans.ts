// agent-execution-loop (Sprint 5/8) — tipos.

export type PlanStatus =
  | 'pending' | 'approved' | 'rejected' | 'expired'
  | 'executed' | 'partial' | 'failed'
  | 'running' | 'rolled_back' | 'aborted';

export interface PlanRow {
  id: string;
  company_id: string;
  conversation_id: string | null;
  message_id: string | null;
  requested_by_agent: string;
  human_summary: string;
  rationale: string | null;
  status: PlanStatus;
  expires_at: string;
  decided_by: string | null;
  decided_at: string | null;
  executed_at: string | null;
  started_at: string | null;
  executed_steps_count: number;
  failed_at_step: number | null;
  ledger_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface PlanStepRow {
  id: string;
  plan_id: string;
  plan_step_order: number;
  action_type: string;
  payload: Record<string, unknown>;
  human_summary: string;
  status: string;
  executed_at: string | null;
}
