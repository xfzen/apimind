# Gate 0 validation bundle

This directory is a standalone feasibility harness for the frozen ECP G0 inputs.
It validates Casdoor lifecycle and authorization behavior, Connector manifest
compatibility, PostgreSQL/MySQL migration semantics, and empty-environment
backup/restore. All containers are addressed by immutable publisher digest.

Run `../scripts/verify-prototypes.sh` from any checkout. The harness creates
only disposable `ecp-gate0-*` Docker resources and removes older resources with
those exact names before and after each run.

Required host tools: Docker with Compose support, POSIX shell, curl, jq, Node.js
24+, and the repository-declared Go 1.25.12 toolchain.
