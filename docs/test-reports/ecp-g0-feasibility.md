# ECP G0 feasibility report

Date: 2026-08-23

Scope: Gate 0 only; this report authorizes scaffolding and does not claim the future server, SDK, UI, or deployment is complete.

## Frozen inputs

All toolchains, Go modules, npm packages, registries, and container images are exact entries in `ecp/versions.lock.yaml`. Go 1.25.12 and Node 24.19.0 checksums came from their publisher release endpoints; Go module sums came from the official Go module proxy; npm integrity values came from the official npm Registry; container references use publisher images plus immutable multi-platform and per-platform digests. The three OCI indexes were checked with `docker buildx imagetools inspect` and contain both `linux/amd64` and `linux/arm64`.

The initial combined generator graph failed because `goctl v1.9.2` and `goctl-swagger v0.2.0` selected both the old monolithic and new split `genproto` modules. Explicitly selecting the official split `googleapis/api` and `googleapis/rpc` snapshot `v0.0.0-20240711142825-46eb208f015d` made `go mod tidy`, `go tool goctl --version`, and `go tool goctl-swagger --version` repeatably pass without a `replace`, mirror, or ambient executable.

## Decisions and evidence

| Mandatory item | Decision | Evidence |
| --- | --- | --- |
| Official sources, checksums, exact versions, image architectures | pass | `verify-inputs.sh`; local RepoDigest checks for all three images |
| Organization/Application/User/Group/Role/Permission APIs | pass | real pinned Casdoor container; both Casdoor prototype scripts |
| Stable external identity and direct-group lifecycle | pass | external ID survives group and forbidden updates; direct group, polling, delete validated |
| Disable/delete, reserved namespace, owner recovery | pass | forbidden flag, API deletion, rejected built-in user creation, built-in admin recovery verified |
| Restricted resource, explicit role override, batch decisions | pass | direct and role grants; resource/action denials; 100-request batch with 50 allow and 50 deny |
| Target sustained policy scale | accepted_limit | first-enterprise capacity profile is absent; Gate 0 proves a 100-decision batch only (observed local elapsed 22-38 ms across recorded runs, not a production SLA) |
| Change continuity | accepted_limit | G0 uses incremental list polling and reconciliation; unverified event delivery is not required |
| Cross-version Casdoor upgrade | accepted_limit | locked-version restart and restored-data startup pass; each future upgrade requires a dedicated N/N-1 run |
| PostgreSQL/MySQL common migration behavior | pass | unique constraints, rollback, timestamp(6), runtime grants, down/up cycle pass on pinned images |
| Product Manifest N/N-1 compatibility | pass | unknown fields, capability intersection, stable errors, signing/tamper rejection, downgrade refusal pass |
| Coordinated backup and empty restore | pass | real Casdoor fixture plus separate ECP and product databases; identities, policy, resource, and sequence continuity pass |
| SIEM or immutable external sink | accepted_limit | G0 provides exportable audit flow; external sink becomes mandatory only when required by a target enterprise |
| External Secret Manager | accepted_limit | G0 accepts externally injected secret references and bundles no vendor-specific manager |
| HA | accepted_limit | G0 is one ECP deployment per enterprise and starts as one service instance |
| SCIM | accepted_limit | G0 uses OIDC/JIT plus reconciled direct-group polling; SCIM is conditional scope |
| Online consistent snapshot | accepted_limit | the verified operational floor is a short read-only coordinated backup window |

There are no `fail` or `unknown` mandatory decisions. Every `accepted_limit` is explicitly bounded by the Gate 0 section of the product Spec.

## Reproduction

```sh
./ecp/scripts/verify-inputs.sh
./ecp/tests/gate0_policy_test.sh
./ecp/scripts/verify-prototypes.sh
```

`verify-prototypes.sh` copies only the lock, tools module, validation bundle, and Gate 0 scripts into a clean temporary directory before executing them. It therefore proves the Gate 0 bundle has no dependency on the ApiMind parent repository. Full ECP-only build/deploy proof remains a Gate D and final-acceptance requirement.
