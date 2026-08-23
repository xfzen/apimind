CREATE TABLE oidc_clients (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  client_id VARCHAR(128) NOT NULL,
  secret_reference VARCHAR(512) NOT NULL,
  redirect_uris TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  disabled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_oidc_clients_enterprise_client UNIQUE (enterprise_id, client_id),
  CONSTRAINT uq_oidc_clients_enterprise_instance UNIQUE (enterprise_id, instance_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON oidc_clients TO ecp_runtime;
