ALTER TABLE policy_projections
  ADD COLUMN casdoor_permission_id VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE policy_projections
  ALTER COLUMN casdoor_permission_id DROP DEFAULT;
