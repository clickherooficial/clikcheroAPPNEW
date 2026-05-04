-- agent-execution-loop (Sprint 5/8)
-- Adiciona colunas pra tracking de execucao sequencial de plans + futuro rollback.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS executed_steps_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_at_step int,
  ADD COLUMN IF NOT EXISTS ledger_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Expandir status check pra incluir running/rolled_back/aborted
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE plans ADD CONSTRAINT plans_status_check CHECK (status IN (
  'pending', 'approved', 'rejected', 'expired', 'executed', 'partial', 'failed',
  'running', 'rolled_back', 'aborted'
));

COMMENT ON COLUMN plans.ledger_ids IS
  'Array de agent_action_ledger.id capturados durante execucao sequencial. Habilita rollback futuro (sprint dedicada).';

COMMENT ON COLUMN plans.failed_at_step IS
  'plan_step_order do passo que falhou (ou NULL se sucesso total). Para inspecao em UI.';

-- aborte cron de plans antigos pendentes pra deixar em peace expirar plans em running tb
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-plans') THEN
    PERFORM cron.unschedule('expire-pending-plans');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-pending-plans',
  '* * * * *',
  $$
    UPDATE plans
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now()
  $$
);
