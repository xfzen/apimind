CREATE TABLE oidc_clients (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  instance_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  secret_reference VARCHAR(512) NOT NULL,
  redirect_uris LONGTEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  disabled_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_oidc_clients_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_oidc_clients_application FOREIGN KEY (application_id) REFERENCES applications(id),
  CONSTRAINT fk_oidc_clients_instance FOREIGN KEY (instance_id) REFERENCES application_instances(id),
  CONSTRAINT uq_oidc_clients_enterprise_client UNIQUE (enterprise_id, client_id),
  CONSTRAINT uq_oidc_clients_enterprise_instance UNIQUE (enterprise_id, instance_id)
) ENGINE=InnoDB;
