# Changelog

## v0.1.0

- Adds the versioned Connector client contract for registration, heartbeat, session resolution, authorization, audit ingestion, lifecycle polling, and Delegation KeySet distribution.
- Adds canonical Ed25519 Delegation signing with fixed `EdDSA` algorithm, audience, purpose, expiry, freshness, and replay verification.
- Adds offline-root-signed, monotonic Delegation KeySet verification with previous-fingerprint chaining.
- Defines the product callback contract for capability, resource, ancestry, projection, health, and version operations.
