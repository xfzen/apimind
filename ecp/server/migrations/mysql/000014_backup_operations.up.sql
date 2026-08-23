CREATE TABLE backup_operations (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  backup_id VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  manifest_hash CHAR(64) NOT NULL,
  failure_reason TEXT NOT NULL,
  started_at TIMESTAMP(6) NOT NULL,
  completed_at TIMESTAMP(6) NULL,
  verified_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_backup_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT uq_backup_id UNIQUE (enterprise_id, backup_id),
  INDEX idx_backup_status (enterprise_id, started_at DESC)
) ENGINE=InnoDB;
