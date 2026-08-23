CREATE TABLE role_bindings (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_instance_id VARCHAR(36) NOT NULL,
  subject_type VARCHAR(16) NOT NULL,
  subject_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_role_binding_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_role_binding_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id),
  CONSTRAINT ck_role_binding_subject_type CHECK (subject_type IN ('principal', 'group')),
  CONSTRAINT uq_role_binding UNIQUE (enterprise_id, application_instance_id, subject_type, subject_id, role_id, resource_type, resource_id)
);
CREATE INDEX idx_role_binding_instance ON role_bindings (enterprise_id, application_instance_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON role_bindings TO ecp_runtime;
