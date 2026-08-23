# ECP local deployment

This is the supported low-threshold, single-enterprise G0 deployment. It runs the pinned Casdoor and PostgreSQL images, keeps `casdoor_db` and `ecp_db` under separate runtime accounts, and exposes only ECP UI `127.0.0.1:4001`, ECP API `127.0.0.1:18890`, and Casdoor `127.0.0.1:4002`.

1. Copy `.env.example` to `.env` and replace every example secret file with a mode-`0600` file outside source control.
2. Configure the Casdoor Organization/Application, change the built-in administrator password immediately, and replace the OIDC and signing-key examples. Example placeholders intentionally fail cryptographic startup/use; they are not fallback keys.
3. Build locked artifacts with `cd ../server && ./scripts/verify.sh`, then build the UI with `cd ../ui && npm ci && npm run build`.
4. Run `../server/scripts/preflight.sh` and `docker compose --env-file .env -f compose.yaml up -d --build --remove-orphans`.

The local stack terminates no production TLS. Put a supported TLS reverse proxy in front of the ECP UI/API and Casdoor for production. Do not expose PostgreSQL. Do not reuse the Casdoor account or database for ECP runtime access.

Backup and restore are coordinated through `server/scripts/backup.sh` and `restore.sh`. A dump in `completed` state is not a verified backup. Only an empty-target restore that validates `manifest.json` changes the status to `verified`. Offboarding exports metadata, revokes sessions and credentials, flushes the product audit outbox, then disables the Connector; it never deletes product databases or resources.
