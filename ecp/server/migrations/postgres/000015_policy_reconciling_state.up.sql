ALTER TABLE policy_projections
  DROP CONSTRAINT policy_projections_reconciliation_state_check;

ALTER TABLE policy_projections
  ADD CONSTRAINT policy_projections_reconciliation_state_check
  CHECK (reconciliation_state IN ('reconciling','in_sync','drifted'));
