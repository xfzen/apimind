ALTER TABLE delegation_keysets
  ADD COLUMN algorithm VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN signed_payload TEXT NOT NULL DEFAULT '';

ALTER TABLE delegation_keysets
  ALTER COLUMN algorithm DROP DEFAULT,
  ALTER COLUMN signed_payload DROP DEFAULT;
