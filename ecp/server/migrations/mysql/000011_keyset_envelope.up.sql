ALTER TABLE delegation_keysets
  ADD COLUMN algorithm VARCHAR(16) NOT NULL DEFAULT '' AFTER keys_json,
  ADD COLUMN signed_payload LONGTEXT NULL AFTER algorithm;

UPDATE delegation_keysets SET signed_payload = '' WHERE signed_payload IS NULL;

ALTER TABLE delegation_keysets
  ALTER COLUMN algorithm DROP DEFAULT,
  MODIFY COLUMN signed_payload LONGTEXT NOT NULL;
