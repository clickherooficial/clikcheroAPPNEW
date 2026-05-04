import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Approval } from '@/hooks/use-approvals';

export type PlanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'executed'
  | 'partial'
  | 'failed'
  | 'running'
  | 'rolled_back'
  | 'aborted';

export interface Plan {
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
  started_at?: string | null;
  executed_steps_count?: number;
  failed_at_step?: number | null;
  ledger_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface PlanWithSteps extends Plan {
  steps: Approval[];
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [steps, setSteps] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [{ data: planRows }, { data: stepRows }] = await Promise.all([
      supabase
        .from('plans' as never)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('approvals' as never)
        .select('*')
        .not('plan_id', 'is', null)
        .order('plan_step_order', { ascending: true }),
    ]);
    setPlans((planRows as unknown as Plan[]) ?? []);
    setSteps((stepRows as unknown as Approval[]) ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Channel name unico por mount (evita "cannot add callbacks after subscribe" em StrictMode)
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`plans-changes-${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plans' },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const decide = useCallback(
    async (planId: string, decision: 'approve' | 'reject') => {
      setDecidingId(planId);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Nao autenticado');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

        const res = await fetch(`${supabaseUrl}/functions/v1/plan-action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plan_id: planId, decision }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

        const planStatus = body.status as PlanStatus;
        const isFullSuccess = planStatus === 'executed' || planStatus === 'rejected';
        const isPartial = planStatus === 'partial';

        toast({
          title: decision === 'approve' ? 'Plano aprovado' : 'Plano rejeitado',
          description: isPartial
            ? `${body.executed}/${body.total} executadas, ${body.failed} falharam`
            : decision === 'approve'
              ? planStatus === 'executed'
                ? `${body.total} acoes executadas com sucesso`
                : 'Falhou na execucao'
              : `${body.steps_count} acoes canceladas`,
          variant: isFullSuccess ? 'default' : 'destructive',
        });
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        toast({ title: 'Erro ao decidir plano', description: msg, variant: 'destructive' });
      } finally {
        setDecidingId(null);
      }
    },
    [toast, load]
  );

  // Combina plan + steps
  const plansWithSteps: PlanWithSteps[] = plans.map((p) => ({
    ...p,
    steps: steps.filter((s) => s.plan_id === p.id),
  }));

  const pending = plansWithSteps.filter((p) => p.status === 'pending');
  const history = plansWithSteps.filter((p) => p.status !== 'pending');

  // Sprint 5: executar plano aprovado sequencialmente via agent-plan-execute
  const executeNow = useCallback(
    async (planId: string) => {
      setDecidingId(planId);
      try {
        const { data, error } = await supabase.functions.invoke('agent-plan-execute', {
          body: { plan_id: planId },
        });
        if (error) throw new Error(error.message);
        const status = (data?.status ?? 'failed') as PlanStatus;
        if (status === 'executed') {
          toast({ title: 'Plano executado', description: `${data.executed}/${data.total} passos OK` });
        } else if (status === 'partial') {
          toast({
            title: 'Plano parcial',
            description: `${data.executed}/${data.total} OK, falhou no step ${data.failed_at_step}: ${data.last_error}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Plano falhou',
            description: data?.last_error ?? data?.error ?? 'erro desconhecido',
            variant: 'destructive',
          });
        }
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        toast({ title: 'Falha ao executar plano', description: msg, variant: 'destructive' });
      } finally {
        setDecidingId(null);
      }
    },
    [toast, load],
  );

  const abort = useCallback(
    async (planId: string) => {
      const { error } = await supabase
        .from('plans' as never)
        .update({ status: 'aborted' })
        .eq('id', planId)
        .eq('status', 'running');
      if (error) {
        toast({ title: 'Falha ao abortar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Plano abortado' });
        await load();
      }
    },
    [toast, load],
  );

  return {
    plans: plansWithSteps,
    pending,
    history,
    isLoading,
    decidingId,
    decide,
    executeNow,
    abort,
  };
}
