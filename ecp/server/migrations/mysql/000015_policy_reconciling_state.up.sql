ALTER TABLE policy_projections
  ADD CONSTRAINT chk_policy_projection_reconciliation_state
  CHECK (reconciliation_state IN ('reconciling','in_sync','drifted'));
