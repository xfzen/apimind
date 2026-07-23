# Contributing

Keep this repository limited to the ApiMind plugin, its two skills, compatibility metadata, documentation, and verification tooling.

Before submitting a change:

1. Preserve the default read-only behavior and explicit confirmation boundary for every remote write.
2. Update `compatibility/server.yaml` only with a matching ApiMind Server contract change.
3. Do not add backend, frontend, desktop App, database, or deployment business code.
4. Do not include credentials, private domains, machine-local paths, or customer-specific bindings.
5. Run `sh scripts/verify.sh` on the host.

The test suite intentionally exercises invalid package fixtures. Add a failing test first for policy or compatibility changes, then make the smallest corresponding implementation change.
