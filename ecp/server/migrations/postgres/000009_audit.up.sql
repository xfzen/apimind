CREATE TABLE audit_event (
  sequence BIGSERIAL PRIMARY KEY,
  id VARCHAR(36) NOT NULL UNIQUE,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  operation_id VARCHAR(128) NOT NULL,
  stage VARCHAR(32) NOT NULL CHECK (stage IN ('intent','change_committed','outcome','product_event')),
  actor_id VARCHAR(64) NOT NULL,
  actor_kind VARCHAR(32) NOT NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  safe_diff TEXT NOT NULL,
  occurred_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX idx_audit_enterprise_sequence ON audit_event (enterprise_id, sequence);
CREATE INDEX idx_audit_instance_sequence ON audit_event (application_instance_id, sequence);
CREATE INDEX idx_audit_operation ON audit_event (operation_id);
CREATE TABLE audit_archive (
  id VARCHAR(36) PRIMARY KEY,
  sequence_start BIGINT NOT NULL,
  sequence_end BIGINT NOT NULL,
  event_count BIGINT NOT NULL,
  canonical_hash CHAR(64) NOT NULL,
  manifest TEXT NOT NULL,
  verified_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL
);
CREATE FUNCTION prevent_online_audit_mutation() RETURNS trigger AS $$
BEGIN
  IF current_user <> 'audit_maintainer' THEN
    RAISE EXCEPTION 'audit_event is append-only';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION prevent_online_audit_mutation();
