CREATE TABLE service_credentials (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  name VARCHAR(128) NOT NULL,
  secret_digest CHAR(64) NOT NULL,
  scopes TEXT NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('active','rotating','revoked')),
  rotation_lineage VARCHAR(64) NOT NULL,
  rotated_from_id VARCHAR(36) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  overlap_until TIMESTAMPTZ(6),
  last_used_at TIMESTAMPTZ(6),
  revoked_at TIMESTAMPTZ(6),
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX idx_service_credentials_instance ON service_credentials (enterprise_id, application_instance_id);
CREATE INDEX idx_service_credentials_lineage ON service_credentials (rotation_lineage);
