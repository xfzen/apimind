# ECP G0 acceptance report

Date: 2026-08-24 10:45 +0800

Acceptance baseline:

- ApiMind monorepo: `626f6421ed3cce848a089d43314901b7897b2de4`
- ApiMind Server gitlink: `242ab91f2f5710461242f0bc7b4d00bee1ca924a`
- ECP version: `0.1.0`

## Result

The enterprise-threshold G0 scenarios pass. Identity is fail-closed, every ApiMind HTTP/MCP surface is classified before protected execution, product resource inheritance works, service credentials can be created and rotated from Admin UI, critical credential/role/principal operations are audited, PostgreSQL/MySQL migrations remain aligned, ECP builds from an isolated copy, and the current ApiMind document workflow remains usable.

One maintainability item is intentionally not represented as completed work: 62 legacy go-zero Logic files still access Repository fields after the fail-closed HTTP authorization middleware. They cannot bypass the enterprise authorization inventory, but moving all of them behind domain services remains a later refactor rather than an enterprise-threshold claim. The implementation plan keeps that item visible.

## Automated evidence

| Boundary | Command | Result |
| --- | --- | --- |
| ECP Server | `cd ecp/server && GOTOOLCHAIN=go1.25.12 ./scripts/verify.sh` | pass: frozen inputs, generation, all Go tests, vet, and Linux artifacts |
| ECP Admin UI | `cd ecp/ui && npm run typecheck && npm test && npm run test:e2e && npm run build` | pass: 10 test files / 17 unit tests, 2 boundary tests, 1 Playwright test, production build |
| ECP standalone | `ECP_STANDALONE_GOCACHE=/private/tmp/apimind-ecp-gocache ./ecp/scripts/verify-standalone.sh` | pass: clean-copy server/SDK/UI builds, PostgreSQL/MySQL up/down/up migrations and audit grant tests |
| ApiMind Server | `cd server && ./scripts/verify.sh` | pass on pinned Server commit; generation, all Go tests, vet, Linux build, Mongo compatibility and provenance checks |
| ApiMind Web | `cd web && npm run lint && npm run typecheck && npm test && npm run build` | pass: lint, typecheck, 35 AVA tests and production build |
| Workspace | `node --test scripts/verify-workspace.test.mjs && node scripts/verify-workspace.mjs` | pass; compatibility manifest equals the Server gitlink |
| Compose | ECP standalone and ApiMind enterprise overlay `docker compose ... config` | pass |
| Backup/restore floor | `docs/test-reports/ecp-g0-feasibility.md` real coordinated empty-restore prototype plus operation-script contract tests | pass for the G0 single-instance, short read-only backup model |

The supported ECP runtime remains Node `24.19.0`. The verification host used Node `25.8.0`, so npm emitted an engine warning; typecheck, tests and builds passed. Vite also reports a non-blocking large-chunk warning.

## Chrome live smoke

The smoke used the user's current local Chrome session against ECP UI `http://127.0.0.1:4001` and ApiMind Web `http://127.0.0.1:4000`.

| Time (+0800) | Scenario | Evidence | Result |
| --- | --- | --- | --- |
| 10:20-10:25 | ECP reauthentication | expired identity freshness removed the old Admin session; Casdoor `admin (Admin)` restored a fresh session | pass; fail-closed and recovery both observed |
| 10:21 | Product resource visibility | project resource search returned only the visible default `工作区文档`; a workspace-admin binding on workspace `14` authorized its project descendant | pass |
| 10:22 | ApiMind enterprise login | `/api/enterprise/auth/start` completed through Casdoor and returned to workspace `个人空间` | pass |
| 10:23 | Default document project | `工作区文档` opened without a separate Document Center bootstrap button | pass |
| 10:24 | Markdown outline | saved `Live Smoke` Markdown with H1/H2/H3; preview rendered and OUTLINE showed `Live Smoke / 概览 / 细节` | pass |
| 10:35 | Service credential creation | Admin UI created `Live Smoke Credential` scoped to `workspace:14:workspace.read`; secret appeared once | pass |
| 10:35 and 10:39 | Service credential rotation | Admin UI rotated the credential and displayed the replacement secret once | pass |
| 10:39 | Credential audit | audit page showed intent and succeeded records for `credential.rotate` | pass |
| 10:35 | Audit query/export | audit list loaded and a verifiable export job was created from the Admin UI | pass |
| 10:44 | Admin identity freshness | a stale Admin identity was rejected and the UI returned to login; a fresh Casdoor login restored access | pass |
| 10:45 | Runtime health and instance ownership | ECP health returned `status=ok`; ApiMind version endpoint succeeded; exactly one current ECP API/UI and one ApiMind Server/Web container were running | pass |

The only available local Principal is the bootstrap administrator. Live suspension of that Principal was not performed because the local overlay has no second administrator and suspension is intentionally fail-closed. Equivalent evidence is provided by the pinned Casdoor disable/delete runtime prototype, lifecycle precedence tests, Admin-session stale/blocked tests, and the audited `principal.block` Logic test.

## Retained smoke data

The `Live Smoke` document group/document and `Live Smoke Credential` remain in the local test deployment. Repository policy forbids deleting ApiMind resources, and the credential is retained so its rotation/audit lineage can be inspected. No one-time secret value is recorded in this report or committed to the repository.

## Follow-up outside the G0 threshold

- Move the remaining legacy Logic Repository access behind domain services in business-domain batches. Authorization is already enforced before those Logic methods execute; this is maintainability convergence, not an authorization bypass fix.
- Split the Admin UI bundle after usage data justifies it; the current warning does not affect correctness.
- Re-run the N/N-1 and coordinated restore evidence before every production upgrade, as required by the Spec.
