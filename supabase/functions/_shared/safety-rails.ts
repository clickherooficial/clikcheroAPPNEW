/**
 * agent-safety-rails — Sprint 1/8
 *
 * Helper compartilhado pra TODA Edge Function que executa acao externa
 * (Meta API call, modificacao de estado de cliente, gasto de IA tokens).
 *
 * Uso:
 *   import { withSafetyRails } from '../_shared/safety-rails.ts';
 *
 *   const { result, gate, ledgerId, executed } = await withSafetyRails(
 *     supabaseAdmin,
 *     {
 *       companyId,
 *       agentName: 'campaign-publish',
 *       actionKind: 'publish_campaign',
 *       costBrlEstimate: dailyBudget * 30,
 *       triggeredBy: 'user',
 *       triggeredById: userId,
 *       payload: { proposalId },
 *       targetKind: 'campaign',
 *       idempotencyKey: `publish:${proposalId}`,
 *     },
 *     async () => {
 *       // codigo que chama Meta API
 *       return await callMetaApi(...);
 *     }
 *   );
 *
 *   if (!executed) {
 *     // bloqueado por gate ou simulado em sandbox
 *     return jsonResponse({ blocked: true, reason: gate.block_reason }, 429);
 *   }
 */

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

export interface SafetyGateResult {
  allowed: boolean;
  sandbox?: boolean;
  auto_execute?: boolean;
  block_reason?: BlockReason;
  paused_until?: string;
  paused_reason?: string;
  remaining_quota?: { hour: number; day: number };
  // campos contextuais por reason:
  limit?: number;
  window?: string;
  used?: number;
  cumulative_24h?: number;
  requested?: number;
  limit_brl?: number;
  threshold?: number;
  cost?: number;
}

export interface LogActionArgs {
  companyId: string;
  agentName: string;
  actionKind: string;
  status: LedgerStatus;
  payload?: any;
  result?: any;
  blockReason?: BlockReason;
  targetKind?: string;
  targetExternalId?: string;
  latencyMs?: number;
  costBrlEstimate?: number;
  triggeredBy?: TriggeredBy;
  triggeredById?: string;
  idempotencyKey?: string;
  rolledBackFrom?: string;
}

export interface CheckGatesArgs {
  companyId: string;
  agentName: string;
  actionKind: string;
  costBrlEstimate?: number;
}

export interface WithSafetyRailsArgs {
  companyId: string;
  agentName: string;
  actionKind: string;
  costBrlEstimate?: number;
  triggeredBy?: TriggeredBy;
  triggeredById?: string;
  idempotencyKey?: string;
  payload?: any;
  targetKind?: string;
  targetExternalId?: string;
}

export interface WithSafetyRailsResult<T> {
  result?: T;
  gate: SafetyGateResult;
  ledgerId: string;
  executed: boolean;
  simulated: boolean;
}

export class SafetyBlockedError extends Error {
  blockReason: BlockReason;
  ledgerId: string;
  gate: SafetyGateResult;
  constructor(reason: BlockReason, ledgerId: string, gate: SafetyGateResult) {
    super(`safety_blocked: ${reason}`);
    this.blockReason = reason;
    this.ledgerId = ledgerId;
    this.gate = gate;
  }
}

/**
 * Consulta safety gates antes de executar acao externa.
 * Wrapper fino sobre RPC `check_safety_gates`.
 */
export async function checkSafetyGates(
  supabaseAdmin: SupabaseClient,
  args: CheckGatesArgs,
): Promise<SafetyGateResult> {
  const { data, error } = await supabaseAdmin.rpc('check_safety_gates', {
    p_company_id: args.companyId,
    p_agent_name: args.agentName,
    p_action_kind: args.actionKind,
    p_cost_brl_estimate: args.costBrlEstimate ?? null,
  });
  if (error) throw new Error(`safety_check_failed: ${error.message}`);
  return data as SafetyGateResult;
}

/**
 * Append-only insert no ledger via RPC.
 */
export async function logAgentAction(
  supabaseAdmin: SupabaseClient,
  args: LogActionArgs,
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('log_agent_action', {
    p_company_id: args.companyId,
    p_agent_name: args.agentName,
    p_action_kind: args.actionKind,
    p_status: args.status,
    p_payload: args.payload ?? {},
    p_result: args.result ?? null,
    p_block_reason: args.blockReason ?? null,
    p_target_kind: args.targetKind ?? null,
    p_target_external_id: args.targetExternalId ?? null,
    p_latency_ms: args.latencyMs ?? null,
    p_cost_brl_estimate: args.costBrlEstimate ?? null,
    p_triggered_by: args.triggeredBy ?? 'agent',
    p_triggered_by_id: args.triggeredById ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_rolled_back_from: args.rolledBackFrom ?? null,
  });
  if (error) throw new Error(`log_action_failed: ${error.message}`);
  return data as string;
}

/**
 * Wrapper unico — gate + execute + log. Usar em todas as Edge Fns que executam acao externa.
 *
 * Comportamento:
 * - Se bloqueado por gate: insere ledger (status='blocked') e retorna { executed: false }
 * - Se sandbox_mode: insere ledger (status='simulated') e retorna { executed: false, simulated: true }
 * - Se autorizado: executa o callback, insere ledger (status='succeeded'|'failed'), retorna result + executed: true
 *
 * Em caso de erro do callback, propaga (apos logar status='failed').
 */
export async function withSafetyRails<T>(
  supabaseAdmin: SupabaseClient,
  args: WithSafetyRailsArgs,
  execute: () => Promise<T>,
): Promise<WithSafetyRailsResult<T>> {
  const t0 = Date.now();
  const gate = await checkSafetyGates(supabaseAdmin, args);

  if (!gate.allowed) {
    const ledgerId = await logAgentAction(supabaseAdmin, {
      companyId: args.companyId,
      agentName: args.agentName,
      actionKind: args.actionKind,
      status: 'blocked',
      payload: args.payload,
      result: { gate },
      blockReason: gate.block_reason,
      targetKind: args.targetKind,
      targetExternalId: args.targetExternalId,
      latencyMs: Date.now() - t0,
      costBrlEstimate: args.costBrlEstimate,
      triggeredBy: args.triggeredBy ?? 'agent',
      triggeredById: args.triggeredById,
      idempotencyKey: args.idempotencyKey,
    });
    return { gate, ledgerId, executed: false, simulated: false };
  }

  // sandbox: log como simulado, NAO executa
  if (gate.sandbox) {
    const ledgerId = await logAgentAction(supabaseAdmin, {
      companyId: args.companyId,
      agentName: args.agentName,
      actionKind: args.actionKind,
      status: 'simulated',
      payload: args.payload,
      result: { simulated: true, would_execute: args.actionKind, gate },
      targetKind: args.targetKind,
      targetExternalId: args.targetExternalId,
      latencyMs: Date.now() - t0,
      costBrlEstimate: args.costBrlEstimate,
      triggeredBy: args.triggeredBy ?? 'agent',
      triggeredById: args.triggeredById,
      idempotencyKey: args.idempotencyKey,
    });
    return { gate, ledgerId, executed: false, simulated: true };
  }

  // executa real
  try {
    const result = await execute();
    const ledgerId = await logAgentAction(supabaseAdmin, {
      companyId: args.companyId,
      agentName: args.agentName,
      actionKind: args.actionKind,
      status: 'succeeded',
      payload: args.payload,
      result: result as any,
      targetKind: args.targetKind,
      targetExternalId: args.targetExternalId,
      latencyMs: Date.now() - t0,
      costBrlEstimate: args.costBrlEstimate,
      triggeredBy: args.triggeredBy ?? 'agent',
      triggeredById: args.triggeredById,
      idempotencyKey: args.idempotencyKey,
    });
    return { result, gate, ledgerId, executed: true, simulated: false };
  } catch (e: any) {
    const ledgerId = await logAgentAction(supabaseAdmin, {
      companyId: args.companyId,
      agentName: args.agentName,
      actionKind: args.actionKind,
      status: 'failed',
      payload: args.payload,
      result: { error: e?.message ?? String(e) },
      targetKind: args.targetKind,
      targetExternalId: args.targetExternalId,
      latencyMs: Date.now() - t0,
      costBrlEstimate: args.costBrlEstimate,
      triggeredBy: args.triggeredBy ?? 'agent',
      triggeredById: args.triggeredById,
      idempotencyKey: args.idempotencyKey,
    });
    // re-throw com info do ledger pra caller poder responder com 500 + ledger_id
    (e as any).ledgerId = ledgerId;
    throw e;
  }
}
