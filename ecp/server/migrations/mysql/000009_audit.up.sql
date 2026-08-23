CREATE TABLE audit_event (
  sequence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id VARCHAR(36) NOT NULL UNIQUE,
  enterprise_id VARCHAR(36) NOT NULL,
  application_instance_id VARCHAR(36) NOT NULL,
  operation_id VARCHAR(128) NOT NULL,
  stage VARCHAR(32) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_kind VARCHAR(32) NOT NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  safe_diff TEXT NOT NULL,
  occurred_at TIMESTAMP(6) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  KEY idx_audit_enterprise_sequence (enterprise_id, sequence),
  KEY idx_audit_instance_sequence (application_instance_id, sequence),
  KEY idx_audit_operation (operation_id),
  CONSTRAINT fk_audit_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_audit_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id)
) ENGINE=InnoDB;
CREATE TABLE audit_archive (
  id VARCHAR(36) PRIMARY KEY,
  sequence_start BIGINT UNSIGNED NOT NULL,
  sequence_end BIGINT UNSIGNED NOT NULL,
  event_count BIGINT UNSIGNED NOT NULL,
  canonical_hash CHAR(64) NOT NULL,
  manifest TEXT NOT NULL,
  verified_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL
) ENGINE=InnoDB;
