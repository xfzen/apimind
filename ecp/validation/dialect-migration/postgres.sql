CREATE TABLE ecp_gate0_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enterprise_id VARCHAR(64) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_ecp_gate0_enterprise_external UNIQUE (enterprise_id, external_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecp_runtime') THEN
    CREATE ROLE ecp_runtime LOGIN PASSWORD 'ecp-gate0-runtime';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE ecp_gate0 TO ecp_runtime;
GRANT USAGE ON SCHEMA public TO ecp_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ecp_gate0_records TO ecp_runtime;
GRANT USAGE, SELECT ON SEQUENCE ecp_gate0_records_id_seq TO ecp_runtime;
