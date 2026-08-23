CREATE TABLE backup_operations (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  backup_id VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  manifest_hash CHAR(64) NOT NULL,
  failure_reason TEXT NOT NULL,
  started_at TIMESTAMPTZ(6) NOT NULL,
  completed_at TIMESTAMPTZ(6),
  verified_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_backup_id UNIQUE (enterprise_id, backup_id)
);

CREATE INDEX idx_backup_status ON backup_operations (enterprise_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON backup_operations TO ecp_runtime;
