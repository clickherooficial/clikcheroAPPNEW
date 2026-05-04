/**
 * agent-safety-rails — tipos compartilhados frontend/backend
 * Spec: .kiro/specs/agent-safety-rails/
 */

export type LedgerStatus = 'simulated' | 'succeeded' | 'failed' | 'blocked' | 'rolled_back';

export type BlockReason =
  | 'rate_limit'
  | 'circuit_breaker'
  | 'spend_velocity'
  | 'sandbox_mode'
  | 'paused'
  | 'requires_approval'
  | 'config_disabled';

export type TriggeredBy = 'user' | 'agent' | 'cron' | 'rule' | 'plan';

export interface SafetyConfig {
  id: string;
  company_id: string;
  auto_execute_enabled: boolean;
  sandbox_mode: boolean;
  max_actions_per_hour: number;
  max_actions_per_day: number;
  max_spend_increase_pct_per_day: number;
  max_spend_decrease_pct_per_day: number;
  circuit_breaker_threshold: number;
  circuit_breaker_cooldown_minutes: number;
  require_approval_above_brl: number;
  paused_until: string | null;
  paused_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type SafetyConfigPatch = Partial<
  Pick<
    SafetyConfig,
    | 'auto_execute_enabled'
    | 'sandbox_mode'
    | 'max_actions_per_hour'
    | 'max_actions_per_day'
    | 'max_spend_increase_pct_per_day'
    | 'max_spend_decrease_pct_per_day'
    | 'circuit_breaker_threshold'
    | 'circuit_breaker_cooldown_minutes'
    | 'require_approval_above_brl'
    | 'paused_until'
    | 'paused_reason'
  >
>;

export interface SafetyStatus {
  config: SafetyConfig;
  actions_last_1h: number;
  actions_last_24h: number;
  cumulative_spend_24h: number;
  consecutive_failures: number;
  is_paused: boolean;
  paused_until: string | null;
  paused_reason: string | null;
  top_block_reasons_7d: Partial<Record<BlockReason, number>>;
  // erro de RPC (no_company / no_config_found)
  error?: string;
}

export interface ActionLedgerRow {
  id: string;
  company_id: string;
  agent_name: string;
  action_kind: string;
  target_kind: string | null;
  target_external_id: string | null;
  payload_jsonb: Record<string, unknown>;
  result_jsonb: Record<string, unknown> | null;
  status: LedgerStatus;
  block_reason: BlockReason | null;
  latency_ms: number | null;
  cost_brl_estimate: number | null;
  triggered_by: TriggeredBy;
  triggered_by_id: string | null;
  rolled_back_from: string | null;
  idempotency_key: string | null;
  executed_at: string;
}

// ============================================================================
// Labels PT-BR
// ============================================================================

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  rate_limit: 'Limite de acoes por hora/dia',
  circuit_breaker: 'Circuit breaker disparado',
  spend_velocity: 'Limite de aumento de gasto',
  sandbox_mode: 'Modo simulacao ativo',
  paused: 'Agente pausado',
  requires_approval: 'Requer aprovacao humana',
  config_disabled: 'Auto-execucao desligada',
};

export const STATUS_LABELS: Record<LedgerStatus, string> = {
  simulated: 'Simulado',
  succeeded: 'Executado',
  failed: 'Falhou',
  blocked: 'Bloqueado',
  rolled_back: 'Revertido',
};

export const TRIGGERED_BY_LABELS: Record<TriggeredBy, string> = {
  user: 'Usuario',
  agent: 'Agente IA',
  cron: 'Agendado',
  rule: 'Regra FURY',
  plan: 'Plano',
};

export const STATUS_COLORS: Record<LedgerStatus, string> = {
  simulated: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  succeeded: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-300',
  blocked: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rolled_back: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

// ============================================================================
// Defaults
// ============================================================================

export const SAFETY_DEFAULTS = {
  max_actions_per_hour: 10,
  max_actions_per_day: 50,
  max_spend_increase_pct_per_day: 30,
  max_spend_decrease_pct_per_day: 100,
  circuit_breaker_threshold: 3,
  circuit_breaker_cooldown_minutes: 60,
  require_approval_above_brl: 100,
} as const;

export const SAFETY_LIMITS = {
  max_actions_per_hour: { min: 1, max: 1000 },
  max_actions_per_day: { min: 1, max: 10000 },
  max_spend_increase_pct_per_day: { min: 0, max: 500 },
  max_spend_decrease_pct_per_day: { min: 0, max: 100 },
  circuit_breaker_threshold: { min: 1, max: 20 },
  circuit_breaker_cooldown_minutes: { min: 1, max: 1440 },
  require_approval_above_brl: { min: 0, max: 100000 },
} as const;
