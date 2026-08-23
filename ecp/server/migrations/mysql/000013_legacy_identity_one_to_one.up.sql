ALTER TABLE legacy_identity_mappings
  ADD CONSTRAINT uq_legacy_identity_principal
  UNIQUE (enterprise_id, application_id, legacy_source, principal_id);
