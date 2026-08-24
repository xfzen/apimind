UPDATE policy_projections
SET reconciliation_state = 'drifted', last_error = 'migration rollback interrupted reconciliation'
WHERE reconciliation_state = 'reconciling';

ALTER TABLE policy_projections
  DROP CONSTRAINT policy_projections_reconciliation_state_check;

ALTER TABLE policy_projections
  ADD CONSTRAINT policy_projections_reconciliation_state_check
  CHECK (reconciliation_state IN ('in_sync','drifted'));
