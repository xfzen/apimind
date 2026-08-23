# ECP G0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Repository policy prohibits subagents unless the user explicitly requests delegation.

**Goal:** Build an independently deployable Enterprise Control Plane (`ecp-api` + `ecp-ui`) and complete the first secure ApiMind `ecp-connector` integration without rewriting the existing YApi Web.

**Architecture:** Add a self-contained top-level `ecp/` repository boundary with separate `server` and `sdk/go` modules plus an independent UI and deployment. `ecp-api` is one go-zero REST service whose contract generation mirrors the existing ApiMind Server; business rules live under `internal/service`, GORM persistence under `internal/infra/persistence/gorm`, and Casdoor/Product integrations sit behind adapters. `ecp-ui` is a separate React + Ant Design + Tailwind CSS + Vite TypeScript SPA. ApiMind depends only on the versioned public Connector SDK and HTTP contract, adds a thin product adapter, and routes all enterprise authorization through one backend Authorizer. Moving `ecp/` to its own repository later must not change Go module/import paths.

**Tech Stack:** Go 1.25.12, go-zero 1.10.2, goctl 1.9.2, goctl-swagger 0.2.0, GORM 1.31.2, GORM PostgreSQL driver 1.6.2, GORM MySQL driver 1.6.0, golang-migrate 4.19.1, PostgreSQL/MySQL, Casdoor OIDC/OAuth/Casbin APIs, React 18.3.1, React Router declarative mode, Ant Design 6.4, `@ant-design/icons` 6.2, Tailwind CSS 4 with `@tailwindcss/vite`, TypeScript 5.9.3, Vite, Docker Compose. Every actual module/package/image is pinned exactly in `ecp/versions.lock.yaml`, Go module sums, and `package-lock.json`; prose family versions are not resolution rules.

**Spec:** `docs/superpowers/specs/2026-08-23-enterprise-control-plane-spec.md`; `docs/superpowers/specs/2026-08-23-apimind-enterprise-connector-profile-spec.md`

## Global Constraints

- `ecp-api`, `ecp-ui`, `casdoor_db`, `ecp_db`, and every product database remain separate deployment and data boundaries.
- `ecp/` must build and test after being copied alone to a clean directory. ECP code cannot import or execute files from the parent ApiMind `server/`, `web/`, `deploy/`, or `Makefile`.
- `ecp/server` uses module `github.com/xfzen/ecp/server`; `ecp/sdk/go` uses module `github.com/xfzen/ecp/sdk/go`. The SDK owns Connector v1 wire types, error codes, canonical signing/verification, and typed clients; it imports no ECP server internals.
- The ApiMind root `go.work` is the canonical monorepo integration boundary for this phase. The unpublished SDK is resolved only as a workspace main module; ApiMind does not record a fictitious remote version and committed modules never contain local `replace` directives. A released SDK requirement becomes mandatory only before a future repository split.
- G0 is one ECP deployment per enterprise; all ECP rows still carry `enterprise_id`.
- `ecp-api` is a single go-zero REST service in G0; do not introduce zRPC, Kafka, a microfrontend runtime, or a second authorization engine.
- `ecp/server/docs/ecp.api` is the only goctl HTTP entry; `docs/apis/*.api` contains imported domain types.
- Generated `api/internal/handler/routes.go` and `api/internal/types/types.go` are never edited manually.
- API Handler/Logic files stay thin; business rules live in `internal/service/*`; GORM is only used under `internal/infra/persistence/gorm`.
- Runtime `AutoMigrate` is forbidden. PostgreSQL and MySQL use separate versioned SQL migrations and both run in CI.
- Browser code calls only Go-side same-origin APIs; neither `ecp-ui` nor ApiMind Web calls Casdoor, ECP Connector, or product business APIs directly.
- Ant Design is the only standard component system in `ecp-ui`; Tailwind is limited to layout, spacing, sizing, responsive utilities, and small presentation helpers.
- Tailwind Preflight is disabled. Ant Design Theme Tokens configured through `ConfigProvider` own product colors, typography, radius, density, and interactive state semantics.
- React, Ant Design, Tailwind, fonts, and product scripts are bundled at build time; no runtime CDN or product-supplied JavaScript is allowed.
- Product resource bodies remain in product databases. ECP stores only stable identity mappings, policy projections, resource references, sessions, credentials, and audit events.
- Human authorization fails closed after the Identity Freshness Deadline; blocked and pending principals are denied before Casbin evaluation.
- Dependencies and build inputs come only from official upstream registries or publisher repositories.
- The required Go version is the repository-declared Go 1.25.12. If the current toolchain is older, obtain it only through the official Go toolchain flow and require published checksum verification; do not change `go.mod` to match the workstation.
- Local development uses ApiMind Web `4000`, ApiMind app-dev API `18889`, ECP UI `4001`, and ECP API `18890`; desktop embedded `18888` remains separate.
- Starting or restarting ApiMind/ECP locally replaces older instances from this checkout. Never leave multiple competing instances bound to alternate ports, and do not package the desktop app during this plan.
- Preserve existing user changes and use explicit Git staging. Each task ends in an independently reviewable commit.

## Target File Map

```text
ecp/
├── go.work
├── versions.lock.yaml
├── scripts/{verify-inputs,verify-prototypes,verify-boundary,verify-standalone}.sh
├── server/
│   ├── api/ecp.go
│   ├── api/internal/{handler,logic,middleware,svc,types}
│   ├── config/{config.go,load.go}
│   ├── docs/ecp.api
│   ├── docs/apis/{common,auth,enterprise,identity,application,access,credential,audit,connector,operation}.api
│   ├── etc/{ecp,ecp.local,ecp.docker}.yaml
│   ├── internal/domain/
│   ├── internal/service/
│   ├── internal/infra/{casdoor,connector,persistence/gorm}
│   ├── migrations/{embed.go,postgres,mysql}
│   ├── scripts/{genapi.sh,gencontracts.sh,verify.sh}
│   ├── tests/
│   └── go.mod
├── sdk/go/
│   ├── connector/v1/{types,errors,signing,client}.go
│   ├── connector/v1/*_test.go
│   └── go.mod
├── tools/{go.mod,go.sum}
├── ui/
│   ├── src/{app,auth,users,groups,applications,access,credentials,audit,operations,api}
│   ├── src/styles/{index.css,theme.ts}
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
└── deploy/
    ├── compose.yaml
    ├── compose.test.yaml
    └── README.md

server/
├── docs/apis/enterprise.api
├── internal/ecp/
├── internal/infra/persistence/mongo/ecp_*.go
└── api/internal/svc/servicecontext.go

web/client/
├── components/Header/Header.tsx
├── containers/Login/Login.tsx
├── containers/Group/MemberList/MemberList.tsx
└── containers/Project/Setting/ProjectMember/ProjectMember.tsx
```

---

## Gate 0: Feasibility Evidence and Frozen Inputs

### Task 0: Validate mandatory assumptions before writing production code

**Files:**
- Create: `ecp/versions.lock.yaml`
- Create: `ecp/validation/README.md`
- Create: `ecp/validation/casdoor-policy/{README.md,run.sh,fixtures.yaml}`
- Create: `ecp/validation/casdoor-lifecycle/{README.md,run.sh,fixtures.yaml}`
- Create: `ecp/validation/manifest-compat/{README.md,run.sh,v1.yaml,v0.yaml}`
- Create: `ecp/validation/dialect-migration/{README.md,run.sh,postgres.sql,mysql.sql}`
- Create: `ecp/validation/backup-restore/{README.md,run.sh}`
- Create: `ecp/tools/{go.mod,go.sum}` with Go 1.25 `tool` directives for pinned goctl and goctl-swagger commands.
- Create: `ecp/scripts/{verify-inputs,verify-prototypes}.sh`
- Create: `docs/test-reports/ecp-g0-feasibility.md`
- Modify if evidence requires it: both linked ECP specs and this plan.

**Interfaces:**
- Consumes: only official Casdoor, Go, Go module, npm, PostgreSQL and MySQL publisher sources.
- Produces: reproducible evidence, a frozen input manifest, explicit `pass/accepted_limit/fail` decisions, and the only authorization to enter Gate A.

- [x] **Step 1: Freeze verified build and runtime inputs**

Record exact version, official source URL, checksum or immutable multi-platform image digest, supported architectures, and verification command for every build/runtime input. Initial image baselines are:

```text
casbin/casdoor:3.154.4@sha256:95c7be68fb98daf2ec74a10c9f785af1ef75e8fef6dd4aad455a899e651e87e2
postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929
mysql:8.4.6@sha256:869218921e61d6c3c89820955d63cca42971f0e3e6c1e2792247bbd944ebc6e9
```

Pin goctl and goctl-swagger in the Gate 0 `ecp/tools/go.mod`; build them into a checkout-local ignored tool directory. Never resolve generators from the ambient PATH. Freeze the exact future GORM, both database drivers, migration library and UI package versions in `versions.lock.yaml`; their `go.mod/go.sum` and `package.json/package-lock.json` do not exist until Tasks 1 and 11 and are checked against the frozen values when created. In Gate 0, `verify-inputs.sh` validates the lock schema, official origins, exact versions, module sums available in `ecp/tools`, image digests and prototype inputs; it must not require later production manifests.

`goctl v1.9.2` and `goctl-swagger v0.2.0` initially expose an ambiguous pre/post-split `genproto` graph when added together. Resolve this only by pinning the official `google.golang.org/genproto/googleapis/api` and `/rpc` modules at `v0.0.0-20240711142825-46eb208f015d` in the generated tools graph; `go mod tidy` and both `go tool` commands must then pass twice. Do not split the generators into ambient installs or hide the conflict with `replace` directives.

- [x] **Step 2: Prove Casdoor/Casbin semantics and scale**

Against the pinned image, validate real Organization/Application/User/Group/Role/Permission APIs, stable external IDs, disable/delete behavior, direct-member synchronization, event delivery or incremental polling continuity, restricted resources, explicit role override, owner recovery, reserved namespace drift, batch authorization, and target resource/policy scale. Capture requests, sanitized responses, counts, latency percentiles, restart/upgrade behavior, and all unsupported assumptions.

- [x] **Step 3: Prove database and contract compatibility**

Run the same minimal reversible migration prototype on the pinned PostgreSQL and MySQL images, including unique constraints, timestamp precision, transaction rollback, grants and down/up cycles. Build Product Manifest N and N-1 fixtures and prove SDK/server unknown-field behavior, capability negotiation, error compatibility, signature verification, and downgrade refusal.

- [x] **Step 4: Prove the operational floor and decide conditional scope**

Use a short read-only window to back up pinned Casdoor, ECP prototype and product fixture data, restore into an empty environment, and verify identities, policies, sequence continuity and resources. Record explicit G0 decisions for SIEM/immutable sink, external Secret Manager, HA, SCIM and online snapshots based on the first target enterprise requirements.

- [x] **Step 5: Enforce the hard gate**

`docs/test-reports/ecp-g0-feasibility.md` must give every mandatory item `pass` or a Spec-approved `accepted_limit`. Any `fail`, `unknown`, missing evidence, unverified official input, or prototype-boundary failure blocks Gate A. `verify-prototypes.sh` copies only `ecp/versions.lock.yaml`, `ecp/tools`, `ecp/validation` and the two Gate 0 scripts to a clean temporary directory and proves that the validation bundle has no parent-repository dependency. Full server/SDK/UI/Compose standalone verification is intentionally deferred until those artifacts exist and becomes a hard Gate D/acceptance check. Revise the Spec/plan and rerun Gate 0 instead of carrying uncertainty into implementation.

Run:

```bash
./ecp/scripts/verify-inputs.sh
./ecp/scripts/verify-prototypes.sh
```

Expected: both pass and the feasibility report contains no unresolved mandatory item; this result authorizes scaffold work but does not claim the future application already builds.

---

## Gate A: Reproducible ECP Foundation

### Task 1: Scaffold the go-zero contract and deterministic generators

**Files:**
- Create: `ecp/go.work`
- Create: `ecp/server/go.mod`
- Create: `ecp/sdk/go/go.mod`
- Create: `ecp/sdk/go/connector/v1/{types,errors,signing,client}.go`
- Create: `ecp/sdk/go/connector/v1/{signing,client}_test.go`
- Consume: `ecp/tools/{go.mod,go.sum}` frozen in Task 0.
- Create: `ecp/.gitignore`
- Create: `ecp/server/api/ecp.go`
- Create: `ecp/server/config/config.go`
- Create: `ecp/server/config/load.go`
- Create: `ecp/server/etc/ecp.yaml`
- Create: `ecp/server/etc/ecp.local.yaml`
- Create: `ecp/server/etc/ecp.docker.yaml`
- Create: `ecp/server/docs/ecp.api`
- Create: `ecp/server/docs/apis/common.api`
- Create: `ecp/server/docs/apis/operation.api`
- Create: `ecp/server/scripts/genapi.sh`
- Create: `ecp/server/scripts/gencontracts.sh`
- Create: `ecp/server/scripts/verify.sh`
- Create: `ecp/scripts/bootstrap-tools.sh`
- Create: `ecp/scripts/verify-boundary.sh`
- Create: `ecp/server/cmd/contractgen/main.go`
- Create: `ecp/server/internal/contractgen/openapi.go`
- Create: `ecp/server/internal/contractgen/openapi_test.go`
- Create: `ecp/server/api/openapi/v1/openapi.yaml`
- Create: `ecp/server/tests/contracts/generation_test.go`
- Create: `ecp/server/api/internal/svc/servicecontext.go`
- Create generated output: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Consumes: ApiMind generation pattern from `server/docs/apimind.api`, `server/scripts/genapi.sh`, and `server/scripts/gencontracts.sh`.
- Produces: stable modules `github.com/xfzen/ecp/server` and `github.com/xfzen/ecp/sdk/go`, Connector v1 public primitives, `GET /api/v1/meta/health`, `GET /api/v1/meta/version`, deterministic goctl routes/types/OpenAPI, and one runnable `ecp-api` binary.

- [x] **Step 1: Write the failing generation-policy test**

```go
func TestGenerationUsesCanonicalContract(t *testing.T) {
    script, err := os.ReadFile(filepath.Join(repositoryRoot(t), "scripts", "genapi.sh"))
    if err != nil {
        t.Fatal(err)
    }
    body := string(script)
    for _, required := range []string{
        `"$tool_bin/goctl" api go -api docs/ecp.api -dir api`,
        "perl -0pi -e 's/\\n+\\z/\\n/' docs/ecp.api",
        "rm -rf api/etc",
        "rm -rf api/internal/config",
    } {
        if !strings.Contains(body, required) {
            t.Fatalf("genapi.sh missing %q", required)
        }
    }
}
```

- [x] **Step 2: Run the test and verify the missing scaffold fails**

Run: `cd ecp/server && go test ./tests/contracts -run TestGenerationUsesCanonicalContract -count=1`

Expected: FAIL because `scripts/genapi.sh` does not exist.

- [x] **Step 3: Create the canonical API entry and health contract**

```go
syntax = "v1"

import "apis/common.api"
import "apis/operation.api"

@server (
    group:  ecp
    prefix: /api/v1
)
service ecp {
    @handler Health
    get /meta/health returns (HealthResp)

    @handler Version
    get /meta/version returns (VersionResp)
}
```

- [x] **Step 4: Create the generator using the ApiMind ownership pattern**

```sh
#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
ecp_dir=$(CDPATH= cd -- "$repo_dir/.." && pwd)
"$ecp_dir/scripts/bootstrap-tools.sh"
tool_bin="$ecp_dir/.artifacts/toolchain/bin"

"$tool_bin/goctl" api go -api docs/ecp.api -dir api
perl -0pi -e 's/\n+\z/\n/' docs/ecp.api
rm -rf api/etc
rm -rf api/internal/config
```

`bootstrap-tools.sh` verifies `versions.lock.yaml`, then builds the exact goctl and goctl-swagger versions from `ecp/tools/go.mod` into `.artifacts/toolchain/bin`; it never downloads a prebuilt binary from an unofficial source or uses the ambient PATH. Create `gencontracts.sh` with the same ordering as ApiMind: run `genapi.sh`, generate Swagger input into a temporary directory with checkout-local pinned `goctl-swagger v0.2.0`, then run `go run ./cmd/contractgen openapi <temporary-swagger-json>` to write normalized `api/openapi/v1/openapi.yaml`. Run that complete sequence twice in `tests/contracts/generation_test.go` and require byte-identical output. `ecp/.gitignore` ignores `.artifacts/`, `.run/`, service/UI `dist/`, coverage and local secrets, but not lock files.

Before generating the service contract, create the SDK module and a minimal versioned Connector v1 package. `ecp/go.work` uses only `./server`, `./sdk/go`, and `./tools`; it must remain valid after `ecp/` is copied outside ApiMind. The SDK cannot import the server. ECP Server does not require its own SDK merely to exercise the workspace. ApiMind consumes the SDK as a root-workspace main module in Task 13 and does not add an unpublished remote requirement; local `replace` directives remain forbidden.

`verify-boundary.sh` is incremental: it copies only `ecp/` into a clean temporary directory, rejects imports or script paths into the parent repository, and tests every ECP component that exists at the current task. It tests `tools`, `sdk/go`, and `server` as isolated modules with `GOWORK=off`; do not run `go work sync`, because merging generator and runtime build lists leaks tool-only transitive versions into the service graph. Task 1 requires SDK/server/tooling to pass; Task 11 adds UI checks. It does not claim deployment completeness. Task 16 adds `verify-standalone.sh`, which requires every final component including Compose and dual-dialect operations.

- [x] **Step 5: Generate, replace generated wiring with the hand-owned ServiceContext, and implement health/version Logic**

`api/internal/svc/servicecontext.go` imports the root `config` package and exposes only `Config config.Config` in this task. This removes the generated `api/internal/config` dependency before the first build and establishes the same ownership split as ApiMind.

- [x] **Step 6: Run the service and contract tests**

Run:

```bash
cd ecp/server
./scripts/gencontracts.sh
find api config tests cmd internal/contractgen -name '*.go' -type f -exec gofmt -w {} +
go test ./...
go vet ./...
mkdir -p dist
go build -trimpath -o dist/ecp-api ./api
cd ../..
./ecp/scripts/verify-boundary.sh
```

Expected: all commands exit 0; `dist/ecp-api` exists and SDK/server/tooling pass from an ECP-only temporary copy.

- [x] **Step 7: Verify generation is idempotent**

Run:

```bash
cd ecp/server
./scripts/gencontracts.sh
go test ./tests/contracts -run TestGenerationIsIdempotent -count=1
```

Expected: the test runs the full generation sequence twice and proves the canonical contract, generated routes/types, and OpenAPI bytes are identical.

- [x] **Step 8: Commit the foundation**

```bash
git add ecp
git commit -m "feat(ecp): scaffold go-zero api"
```

### Task 2: Add GORM, dialect configuration, and versioned migrations

**Files:**
- Create: `ecp/server/internal/infra/persistence/gorm/db.go`
- Create: `ecp/server/internal/infra/persistence/gorm/dialect.go`
- Create: `ecp/server/internal/infra/persistence/gorm/transaction.go`
- Create: `ecp/server/internal/infra/persistence/gorm/db_test.go`
- Create: `ecp/server/internal/domain/base.go`
- Create: `ecp/server/cmd/migrate/main.go`
- Create: `ecp/server/internal/migration/runner.go`
- Create: `ecp/server/internal/migration/runner_test.go`
- Create: `ecp/server/migrations/embed.go`
- Create: `ecp/server/migrations/postgres/000001_baseline.{up,down}.sql`
- Create: `ecp/server/migrations/mysql/000001_baseline.{up,down}.sql`
- Create: `ecp/server/scripts/migrate.sh`
- Create: `ecp/server/scripts/{test-db-up,test-db-down}.sh`
- Create: `ecp/deploy/compose.test.yaml`
- Modify: `ecp/server/config/config.go`
- Modify: `ecp/server/api/internal/svc/servicecontext.go`
- Modify: `ecp/server/go.mod`

**Interfaces:**
- Produces: `persistence.Open(config DatabaseConfig) (*gorm.DB, error)`, `persistence.WithTx(ctx, db, fn) error`, `migration.Up`, `migration.Down`, `migration.Version`, and the shared `domain.Base` fields.
- Consumes: typed ECP configuration from Task 1.

- [x] **Step 1: Write dialect and rollback tests**

```go
func TestParseDialectRejectsUnknown(t *testing.T) {
    _, err := ParseDialect("sqlite")
    if !errors.Is(err, ErrUnsupportedDialect) {
        t.Fatalf("expected ErrUnsupportedDialect, got %v", err)
    }
}

func TestWithTxRollsBackOnError(t *testing.T) {
    db := openIntegrationDB(t)
    injected := errors.New("injected rollback")
    err := WithTx(context.Background(), db, func(tx *gorm.DB) error {
        if err := tx.Create(&testRow{ID: "rollback"}).Error; err != nil {
            return err
        }
        return injected
    })
    if !errors.Is(err, injected) {
        t.Fatalf("expected injected rollback, got %v", err)
    }
    var count int64
    if err := db.Model(&testRow{}).Where("id = ?", "rollback").Count(&count).Error; err != nil {
        t.Fatal(err)
    }
    if count != 0 {
        t.Fatalf("rolled-back row persisted: count=%d", count)
    }
}
```

- [x] **Step 2: Run tests and verify they fail before persistence exists**

Run: `cd ecp/server && go test ./internal/infra/persistence/gorm -count=1`

Expected: FAIL with undefined persistence symbols.

- [x] **Step 3: Implement the typed database boundary**

```go
type DatabaseConfig struct {
    Driver          string
    DSN             string
    MaxOpenConns    int
    MaxIdleConns    int
    ConnMaxLifetime time.Duration
}

type Dialect string

const (
    DialectPostgres Dialect = "postgres"
    DialectMySQL    Dialect = "mysql"
)
```

Use the exact `versions.lock.yaml`/`go.sum` versions of `gorm.io/driver/postgres`, `gorm.io/driver/mysql`, `gorm.io/gorm`, and `github.com/golang-migrate/migrate/v4` from the official Go module proxy. Package `ecp/server/migrations` owns `embed.go`; its `//go:embed postgres/*.sql mysql/*.sql` is legal because both directories are beneath that package. `internal/migration` imports this exported `fs.FS`. `scripts/migrate.sh` only validates `ECP_DB_DRIVER=postgres|mysql`, requires the offline schema-owner `ECP_MIGRATION_DSN`, selects the matching embedded subdirectory, and invokes `go run ./cmd/migrate`; it must not accept a runtime writer DSN, import a third-party mirror or enable `AutoMigrate`.

- [x] **Step 4: Add equivalent baseline migration tables in both dialects**

The first up migration creates only an `ecp_migration_probe` table used by the migration test; the migration library owns its own schema-version table. The matching down migration drops only `ecp_migration_probe`. Use `VARCHAR(36)` IDs, UTC timestamps at microsecond precision, explicit unique constraints, and no JSONB, arrays, partial indexes, or generated columns.

- [x] **Step 5: Provision and run both migration matrices**

`compose.test.yaml` uses the immutable PostgreSQL/MySQL image digests from `versions.lock.yaml`, isolated test databases/accounts, health checks, ephemeral volumes and no host-wide credentials. `test-db-up.sh` starts the services, waits for both health checks, and writes checkout-local `.run/test-db.env` containing distinct PostgreSQL/MySQL schema-owner migration DSNs. `test-db-down.sh` always removes the project-scoped containers and volumes. CI and local verification source those generated DSNs before migration tests; no test assumes pre-existing environment variables or reuses the migration owner as an online service account.

Run:

```bash
cd ecp/server
./scripts/test-db-up.sh
trap './scripts/test-db-down.sh' EXIT INT TERM
. ./.run/test-db.env
ECP_DB_DRIVER=postgres ECP_MIGRATION_DSN="$ECP_TEST_POSTGRES_MIGRATION_DSN" ./scripts/migrate.sh up
ECP_DB_DRIVER=postgres ECP_MIGRATION_DSN="$ECP_TEST_POSTGRES_MIGRATION_DSN" ./scripts/migrate.sh down 1
ECP_DB_DRIVER=postgres ECP_MIGRATION_DSN="$ECP_TEST_POSTGRES_MIGRATION_DSN" ./scripts/migrate.sh up
ECP_DB_DRIVER=mysql ECP_MIGRATION_DSN="$ECP_TEST_MYSQL_MIGRATION_DSN" ./scripts/migrate.sh up
ECP_DB_DRIVER=mysql ECP_MIGRATION_DSN="$ECP_TEST_MYSQL_MIGRATION_DSN" ./scripts/migrate.sh down 1
ECP_DB_DRIVER=mysql ECP_MIGRATION_DSN="$ECP_TEST_MYSQL_MIGRATION_DSN" ./scripts/migrate.sh up
go test -p 1 ./internal/infra/persistence/gorm ./internal/migration -count=1
trap - EXIT INT TERM
./scripts/test-db-down.sh
```

Expected: PostgreSQL and MySQL migration plus rollback tests pass.

- [x] **Step 6: Commit persistence**

```bash
git add ecp/server
git commit -m "feat(ecp): add dual-dialect persistence"
```

### Task 3: Register enterprises, applications, instances, manifests, and connectors

**Files:**
- Create: `ecp/server/docs/apis/enterprise.api`
- Create: `ecp/server/docs/apis/application.api`
- Create: `ecp/server/docs/apis/connector.api`
- Create: `ecp/server/internal/domain/{enterprise,application,manifest,connector}.go`
- Create: `ecp/server/internal/service/registry/service.go`
- Create: `ecp/server/internal/service/registry/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/{enterprise,application,manifest,connector}_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000002_registry.{up,down}.sql`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`
- Modify: `ecp/server/api/internal/svc/servicecontext.go`

**Interfaces:**
- Produces: `Registry.RegisterApplication`, `Registry.RegisterInstance`, `Registry.PutManifest`, and `Registry.RegisterConnector`.
- Produces HTTP: `POST /api/v1/applications`, `POST /api/v1/applications/:id/instances`, `PUT /api/v1/applications/:id/manifest`, `POST /api/v1/connectors/register`.

- [x] **Step 1: Write service tests for single-enterprise and instance isolation**

```go
func TestRegisterInstanceRequiresKnownApplication(t *testing.T) {
    svc := newRegistryFixture(t)
    _, err := svc.RegisterInstance(context.Background(), RegisterInstanceInput{
        EnterpriseID: "ent-1",
        ApplicationID: "missing",
        InstanceKey: "prod",
    })
    assertReason(t, err, "application_not_found")
}

func TestConnectorCannotCrossInstance(t *testing.T) {
    svc := newRegistryFixture(t)
    credential := svc.issueConnectorCredential(t, "instance-a")
    err := svc.AssertConnectorScope(context.Background(), credential, "instance-b")
    assertReason(t, err, "connector_scope_mismatch")
}
```

- [x] **Step 2: Run the service tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/registry -count=1`

Expected: FAIL because Registry does not exist.

- [x] **Step 3: Implement stable domain types**

```go
type ApplicationInstance struct {
    ID            string
    EnterpriseID  string
    ApplicationID string
    InstanceKey   string
    Environment   string
    CanonicalURL  string
    Status        string
    Version       uint64
}

type ProductManifest struct {
    ApplicationID string
    APIVersion    string
    ManifestHash  string
    Body          []byte
    Version       uint64
}
```

Validate stable machine identifiers, canonical URLs, N/N-1 manifest compatibility, and one active enterprise per deployment.

- [x] **Step 4: Add API fragments and regenerate**

Run: `cd ecp/server && ./scripts/gencontracts.sh`

Expected: registry routes appear under group `ecp`; generated routes/types contain no manual edits.

- [x] **Step 5: Run registry, migration, and contract tests**

Run: `cd ecp/server && go test ./internal/service/registry ./internal/infra/persistence/gorm ./tests/contracts -count=1`

Expected: PASS.

- [x] **Step 6: Commit the registry**

```bash
git add ecp/server
git commit -m "feat(ecp): add product registry"
```

---

## Gate B: Identity, Sessions, and Authorization

### Task 4: Implement the Casdoor adapter and OIDC client registry

**Files:**
- Create: `ecp/server/internal/infra/casdoor/{client,types,errors}.go`
- Create: `ecp/server/internal/infra/casdoor/client_test.go`
- Create: `ecp/server/internal/domain/oidc_client.go`
- Create: `ecp/server/internal/service/oidcclient/service.go`
- Create: `ecp/server/internal/service/oidcclient/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/oidc_client_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000003_oidc_clients.{up,down}.sql`
- Modify: `ecp/server/config/config.go`
- Modify: `ecp/server/api/internal/svc/servicecontext.go`

**Interfaces:**
- Produces: `casdoor.Client` methods `GetUser`, `DisableUser`, `ListDirectGroupMembers`, `ReadPolicies`, `WritePolicies`, and `DeletePolicies`.
- Produces: `OIDCClientService.Register`, `RotateSecret`, `Disable`, and `ValidateRedirect`.
- Produces: `SecretProvider.Get(ctx, reference) ([]byte, error)`; only the Casdoor adapter and server-side OIDC code exchange receive the relevant secret reference.

- [x] **Step 1: Write redirect and credential-boundary tests**

```go
func TestValidateRedirectRequiresExactHTTPSURI(t *testing.T) {
    svc := newOIDCClientFixture(t)
    err := svc.ValidateRedirect("https://api.example.com/callback", "https://api.example.com/callback/extra")
    assertReason(t, err, "redirect_uri_mismatch")
}

func TestProductCannotReadClientSecret(t *testing.T) {
    record := newOIDCClientFixture(t).storedRecord()
    if record.SecretReference == "" || strings.Contains(record.SecretReference, "secret-value") {
        t.Fatal("OIDC record must contain only a secret reference")
    }
}

func TestProductionRejectsDynamicClientRegistration(t *testing.T) {
    routes := registeredRoutes(t)
    if routes.Has("POST", "/api/v1/oidc/register") {
        t.Fatal("production router exposes dynamic client registration")
    }
}
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd ecp/server && go test ./internal/infra/casdoor ./internal/service/oidcclient -count=1`

Expected: FAIL because the adapter and service do not exist.

- [x] **Step 3: Implement a narrow Casdoor interface using official APIs**

Use `net/http` or the existing official OAuth/OIDC libraries. Bind every adapter credential to one enterprise and keep its raw value in the configured `SecretProvider`, not `ecp_db`. The adapter credential audience and scopes allow only required Casdoor management calls; it cannot authenticate Connector traffic or OIDC relying-party code exchange.

- [x] **Step 4: Implement exact redirect and rotation rules**

Reject wildcards, request-supplied redirect overrides, non-HTTPS production callbacks, open redirects, and cross-instance client reuse. Permit only explicitly configured localhost callbacks in local mode. Production dynamic client registration is disabled; client creation and secret rotation are explicit, audited control-plane operations.

- [x] **Step 5: Run adapter and migration tests**

Run: `cd ecp/server && go test ./internal/infra/casdoor ./internal/service/oidcclient ./internal/infra/persistence/gorm -count=1`

Expected: PASS.

- [x] **Step 6: Commit the Casdoor boundary**

```bash
git add ecp/server
git commit -m "feat(ecp): add casdoor adapter"
```

### Task 5: Implement principal mapping, groups, JIT admission, and lifecycle freshness

**Files:**
- Create: `ecp/server/docs/apis/identity.api`
- Create: `ecp/server/internal/domain/{principal,group,lifecycle}.go`
- Create: `ecp/server/internal/service/identity/service.go`
- Create: `ecp/server/internal/service/identity/service_test.go`
- Create: `ecp/server/internal/service/lifecycle/service.go`
- Create: `ecp/server/internal/service/lifecycle/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/{identity,group,lifecycle}_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000004_identity.{up,down}.sql`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Produces: `Identity.ResolveExternalIdentity`, `Identity.AdmitJIT`, `Identity.CreateManagedGroup`, `Identity.SyncDirectoryGroup`, `Identity.ListDirectGroupMembers`, `Lifecycle.Block`, `Lifecycle.MarkSyncSuccess`, `Lifecycle.MarkSyncFailure`, and `Lifecycle.AssertFresh`.
- Stable denial reasons: `principal_blocked`, `principal_pending_external_sync`, `identity_state_stale`, `identity_conflict`, `jit_not_allowed`.

- [x] **Step 1: Write failing JIT and stale-sync tests**

```go
func TestJITRejectsUnverifiedEmail(t *testing.T) {
    svc := newIdentityFixture(t)
    _, err := svc.AdmitJIT(context.Background(), JITInput{
        Issuer: "https://trusted-idp.example.com",
        Subject: "subject-1",
        Email: "user@example.com",
        EmailVerified: false,
    })
    assertReason(t, err, "jit_not_allowed")
}

func TestIdentitySyncExpiresHumanAllow(t *testing.T) {
    clock := newFakeClock(time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC))
    svc := newLifecycleFixture(t, clock)
    svc.markFresh(t, clock.Now())
    clock.Advance(5*time.Minute + time.Microsecond)
    assertReason(t, svc.AssertFresh(context.Background(), HumanPrincipal), "identity_state_stale")
}

func TestDirectoryManagedGroupRejectsControlPlaneMutation(t *testing.T) {
    svc := newIdentityFixture(t)
    group := svc.createDirectoryManagedGroup(t, "engineering")
    err := svc.AddDirectGroupMember(context.Background(), group.ID, "principal-1")
    assertReason(t, err, "directory_group_read_only")
}
```

- [x] **Step 2: Run identity tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/identity ./internal/service/lifecycle -count=1`

Expected: FAIL because identity services do not exist.

- [x] **Step 3: Implement stable issuer+subject mappings and direct groups**

Do not use email, username, DN, or display name as a primary key. Store direct Casdoor group mappings only; nested groups remain rejected in G0. `ecp_managed` groups permit audited direct-member mutations through the Casdoor adapter; `directory_managed` groups are read-only in ECP and only change through verified directory synchronization. The migration also creates one-time invitations and `legacy_identity_mapping`; invitations bind enterprise, application, normalized verified email, expiry, and use state.

- [x] **Step 4: Implement local denial overlay and sync state**

```go
type SyncState struct {
    EnterpriseID        string
    Provider            string
    Version             uint64
    LastSuccessfulSync  time.Time
    FreshnessDeadline   time.Time
    SourceCursor        string
    State               string // fresh|stale
    LastError           string
}
```

`blocked` and `pending_external_sync` deny immediately. Human/group Allow values cannot outlive `FreshnessDeadline`.

- [x] **Step 5: Regenerate APIs and run identity tests**

Run: `cd ecp/server && ./scripts/gencontracts.sh && go test ./internal/service/identity ./internal/service/lifecycle ./tests/contracts -count=1`

Expected: PASS.

- [x] **Step 6: Commit identity lifecycle**

```bash
git add ecp/server
git commit -m "feat(ecp): add identity lifecycle"
```

### Task 6: Implement OIDC login transactions and isolated admin/product sessions

**Files:**
- Create: `ecp/server/docs/apis/auth.api`
- Create: `ecp/server/internal/domain/session.go`
- Create: `ecp/server/internal/service/session/service.go`
- Create: `ecp/server/internal/service/session/service_test.go`
- Create: `ecp/server/internal/service/idempotency/service.go`
- Create: `ecp/server/internal/service/idempotency/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/session_repo.go`
- Create: `ecp/server/internal/infra/persistence/gorm/idempotency_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000005_sessions.{up,down}.sql`
- Create: `ecp/server/api/internal/middleware/adminsession.go`
- Create: `ecp/server/api/internal/middleware/{csrf,idempotency,ratelimit}.go`
- Create: `ecp/server/api/internal/middleware/security_test.go`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Produces HTTP: `GET /api/v1/auth/start`, `GET /api/v1/auth/callback`, `GET /api/v1/auth/session` (current admin session summary used by UI), `POST /api/v1/auth/logout`, `GET /api/v1/auth/sessions` (admin list), `POST /api/v1/auth/sessions/revoke`, and the machine-only one-time product login exchange.
- Produces: `SessionService.Begin`, `Complete`, `ExchangeProductTransaction`, `Revoke`, and `RevokePrincipal`.
- Produces middleware contracts: browser writes require session-bound CSRF; all writes require `Idempotency-Key` and `Operation-ID`; authentication and credential endpoints use bounded per-source and per-principal rate limits.

- [x] **Step 1: Write replay, audience, and cookie-boundary tests**

```go
func TestProductLoginTransactionIsSingleUse(t *testing.T) {
    svc := newSessionFixture(t)
    transaction := svc.createProductTransaction(t, "apimind-prod")
    if _, err := svc.ExchangeProductTransaction(context.Background(), transaction.ID); err != nil {
        t.Fatal(err)
    }
    _, err := svc.ExchangeProductTransaction(context.Background(), transaction.ID)
    assertReason(t, err, "login_transaction_used")
}

func TestBrowserWriteRejectsMissingCSRF(t *testing.T) {
    handler := newProtectedWriteHandler(t)
    response := performRequest(handler, "POST", "/api/v1/identity/block", nil)
    if response.Code != http.StatusForbidden {
        t.Fatalf("expected 403, got %d", response.Code)
    }
    assertResponseReason(t, response, "csrf_required")
}

func TestIdempotencyKeyCannotChangePayload(t *testing.T) {
    svc := newIdempotencyFixture(t)
    mustBeginOperation(t, svc, "op-1", "key-1", []byte(`{"principal_id":"p1"}`))
    err := svc.Begin(context.Background(), "op-2", "key-1", []byte(`{"principal_id":"p2"}`))
    assertReason(t, err, "idempotency_payload_mismatch")
}
```

- [x] **Step 2: Run session tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/session -count=1`

Expected: FAIL because SessionService does not exist.

- [x] **Step 3: Implement state, PKCE, nonce, audience, expiry, and one-time use**

Admin sessions bind `enterprise_id + principal_id`; product sessions bind `enterprise_id + application_instance_id + principal_id`. Never reuse Cookie names, session IDs, CSRF state, or Casdoor tokens across those domains. Store only hashed session and CSRF material. Browser cookies are `Secure`, `HttpOnly`, and explicitly scoped; every authenticated write validates the session-bound CSRF header before business logic. Idempotency records bind enterprise, operation ID, key, method, canonical path, request hash, response status, response body hash, and expiry. Rate-limit login, callback, credential, policy-repair, and export endpoints without logging secrets.

Split the go-zero contract into explicit route groups so middleware selection is generated and testable:

```text
meta-public:       /meta/*                         no session; read-only
auth-public:       GET /auth/start|callback        login rate limit; OIDC transaction checks
admin-read:        GET /auth/session|sessions      admin session
admin-write:       POST /auth/logout|.../revoke    admin session + CSRF + idempotency + rate limit
connector-machine: /connector/* and login exchange Connector credential + audience/scope + idempotency + rate limit
key-maintainer:    POST /signing-keys/*             dedicated operator credential + keyset.publish scope + idempotency + rate limit
```

All later browser read/write APIs join `admin-read` or `admin-write`; Connector APIs join `connector-machine`; offline key publication joins `key-maintainer` and cannot be authenticated by a browser session, Connector credential, Casdoor Adapter credential or online delegation key. Tests inspect generated route registration and fail if a protected route is placed in the public group or a browser write omits any required middleware. `/auth/session` is singular and is the only endpoint loaded by `ecp-ui` authentication bootstrap; `/auth/sessions` remains a distinct administrative collection endpoint.

- [x] **Step 4: Regenerate auth routes and test callback failures**

Run: `cd ecp/server && ./scripts/gencontracts.sh && go test ./internal/service/session ./internal/service/idempotency ./api/internal/middleware ./api/internal/handler/ecp -count=1`

Expected: invalid state, redirect, PKCE, nonce, expired transaction, and replay tests all pass.

- [x] **Step 5: Commit sessions**

```bash
git add ecp/server
git commit -m "feat(ecp): add oidc product sessions"
```

### Task 7: Implement authorization ordering, Casbin policy projection, drift, and cache versions

**Files:**
- Create: `ecp/server/docs/apis/access.api`
- Create: `ecp/server/internal/domain/{authorization,policy}.go`
- Create: `ecp/server/internal/service/access/service.go`
- Create: `ecp/server/internal/service/access/service_test.go`
- Create: `ecp/server/internal/service/access/cache.go`
- Create: `ecp/server/internal/service/access/cache_test.go`
- Create: `ecp/server/internal/service/policy/service.go`
- Create: `ecp/server/internal/service/policy/service_test.go`
- Create: `ecp/server/internal/domain/security_config.go`
- Create: `ecp/server/internal/service/securityconfig/service.go`
- Create: `ecp/server/internal/service/securityconfig/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/security_config_repo.go`
- Create: `ecp/server/internal/infra/persistence/gorm/policy_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000006_policy_projection.{up,down}.sql`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Produces: `Access.Authorize(ctx, Request) (Decision, error)` and `Access.BatchAuthorize(ctx, []Request) ([]Decision, error)`. Policy denials return a populated `Decision` with `error == nil`; transport, persistence, or policy-engine failures return a non-nil error and never synthesize an Allow.
- Produces: `SecurityConfig.Put`, `SecurityConfig.Get`, and enforced instance-level public sharing/export/secret policies.
- Decision returns `reason`, `lifecycle_version`, `identity_sync_version`, `identity_freshness_deadline`, `policy_version`, and `authorized_resource_version`.
- Cache keys bind enterprise, application instance, principal, direct-group version, action, resource ID/version, lifecycle version, identity-sync version, policy version, and security-config version; a cached human Allow never outlives the identity freshness deadline.

- [x] **Step 1: Write ordering and drift tests**

```go
func TestBlockedPrincipalOverridesCasbinAllow(t *testing.T) {
    svc := newAccessFixture(t, casbinAlwaysAllow())
    svc.blockPrincipal(t, "principal-1")
    decision, err := svc.Authorize(context.Background(), requestFor("principal-1", "project.read"))
    if err != nil {
        t.Fatal(err)
    }
    if decision.Allow || decision.Reason != "principal_blocked" {
        t.Fatalf("unexpected decision: %+v", decision)
    }
}

func TestPolicyDriftDeniesReadAndResourceDiscovery(t *testing.T) {
    svc := newAccessFixture(t, casbinAlwaysAllow())
    svc.markPolicyDrifted(t, "apimind-prod")
    for _, action := range []string{"project.read", "resource.search"} {
        got, err := svc.Authorize(context.Background(), requestFor("principal-1", action))
        if err != nil {
            t.Fatal(err)
        }
        if got.Allow {
            t.Fatalf("drift allowed %s", action)
        }
    }
}

func TestCachedHumanAllowCannotOutliveIdentityFreshness(t *testing.T) {
    clock := newFakeClock(time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC))
    svc := newAccessFixtureWithClock(t, casbinAlwaysAllow(), clock)
    svc.setIdentityFreshnessDeadline(t, clock.Now().Add(5*time.Minute))
    decision, err := svc.Authorize(context.Background(), requestFor("principal-1", "project.read"))
    if err != nil {
        t.Fatal(err)
    }
    if !decision.Allow {
        t.Fatalf("initial decision denied: %+v", decision)
    }
    clock.Advance(5*time.Minute + time.Microsecond)
    decision, err = svc.Authorize(context.Background(), requestFor("principal-1", "project.read"))
    if err != nil {
        t.Fatal(err)
    }
    if decision.Allow || decision.Reason != "identity_state_stale" {
        t.Fatalf("expired cached allow survived: %+v", decision)
    }
}
```

- [x] **Step 2: Run access tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/access ./internal/service/policy ./internal/service/securityconfig -count=1`

Expected: FAIL because authorization services do not exist.

- [x] **Step 3: Implement the fixed decision sequence**

```text
Boundary → Principal/Session → Access State/Freshness → Revocation
→ Policy Drift → Cache Versions → Casdoor/Casbin → Decision
```

Do not add a second grant store. `policy_projection` stores only Casdoor policy IDs, normalized hash, manifest version, policy version, and reconciliation state. Cache lookup occurs only after boundary, principal/session, access-state/freshness, revocation, and policy-drift checks; any version mismatch is a miss. Neither reads nor background work may extend an Allow TTL locally.

- [x] **Step 4: Implement write-read-canonicalize and drift repair**

Every policy mutation performs audited intent, Casdoor mutation, read-back, canonical hash verification, version advance, and cache invalidation. Drift repair requires reauthentication and creates a new policy version.

- [x] **Step 5: Regenerate access routes and run tests**

Run: `cd ecp/server && ./scripts/gencontracts.sh && go test ./internal/service/access ./internal/service/policy ./internal/service/securityconfig ./tests/contracts -count=1`

Expected: ordering, group inheritance, restricted resources, drift, cache expiry, and batch isolation tests pass.

- [x] **Step 6: Commit authorization**

```bash
git add ecp/server
git commit -m "feat(ecp): add policy authorization"
```

---

## Gate C: Connector, Credentials, and Audit

### Task 8: Implement the versioned ecp-connector contract and signed delegation

**Files:**
- Create: `ecp/server/internal/domain/delegation.go`
- Create: `ecp/server/internal/service/connector/service.go`
- Create: `ecp/server/internal/service/connector/service_test.go`
- Create: `ecp/server/internal/infra/connector/client.go`
- Create: `ecp/server/internal/infra/connector/client_test.go`
- Create: `ecp/server/internal/domain/resource_reference.go`
- Create: `ecp/server/internal/domain/projection_outbox.go`
- Create: `ecp/server/internal/infra/persistence/gorm/resource_reference_repo.go`
- Create: `ecp/server/internal/infra/persistence/gorm/projection_outbox_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000007_connector_state.{up,down}.sql`
- Modify: `ecp/sdk/go/connector/v1/{types,errors,signing,client}.go`
- Modify: `ecp/sdk/go/connector/v1/{signing,client}_test.go`
- Create: `ecp/server/internal/service/connector/keyset.go`
- Create: `ecp/server/internal/service/connector/keyset_test.go`
- Create: `ecp/server/cmd/keyset-maintain/main.go`
- Create: `ecp/server/internal/service/connector/keyset_publish_test.go`
- Create: `ecp/sdk/go/CHANGELOG.md`
- Create: `ecp/sdk/go/RELEASE.md`
- Create: `ecp/sdk/go/scripts/verify-release.sh`
- Modify: `ecp/server/docs/apis/connector.api`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Product to ECP: `RegisterInstance`, `Heartbeat`, `ResolveSession`, `Authorize`, `BatchAuthorize`, `IngestAuditEvents`, `GetPolicyVersion`, `PollLifecycleChanges`, `GetDelegationKeySet`, `AckDelegationKeySet`.
- Offline key maintainer to ECP: `PublishDelegationKeySet` using a dedicated operator credential with only `keyset.publish`; Connector and browser credentials are rejected.
- ECP to product: `GetCapabilities`, `SearchResources`, `ResolveResource`, `GetResourceAncestry`, `ApplyCompatibilityProjection`, `GetHealth`, `GetVersion`.
- Trust channels: Product-to-ECP Connector credential and ECP-to-product outbound credential use distinct client IDs, secret references, audiences, scopes, rotation lineages, and replay stores; neither can call Casdoor APIs or perform OIDC code exchange.
- Cryptography: Connector SDK canonical encoding plus Ed25519 Delegation signing/verification with explicit `alg=EdDSA`, `kid`, issuer, audience and purpose; no algorithm negotiation or server-internal types cross the module boundary. `GET /api/v1/connector/signing-keys/delegation` and `POST /api/v1/connector/signing-keys/delegation/ack` belong to `connector-machine` and require instance-scoped `keyset.read`/`keyset.ack` scopes.

- [x] **Step 1: Write confused-deputy, audience, expiry, and replay tests**

```go
func TestDelegationCannotCrossInstance(t *testing.T) {
    signer, verifier := newSigningPair(t)
    token := signer.Sign(t, Delegation{Audience: "instance-a", Nonce: "nonce-1"})
    _, err := verifier.Verify(token, "instance-b", fixedNow())
    assertReason(t, err, "delegation_audience_mismatch")
}

func TestInboundConnectorCredentialCannotAuthenticateOutboundCall(t *testing.T) {
    svc := newConnectorFixture(t)
    inbound := svc.issueInboundCredential(t, "instance-a")
    err := svc.AuthenticateOutbound(context.Background(), inbound.Raw, "instance-a")
    assertReason(t, err, "connector_trust_channel_mismatch")
}
```

- [x] **Step 2: Run Connector tests and verify failure**

Run: `cd ecp && go test ./sdk/go/connector/v1 -count=1 && cd server && ./scripts/gencontracts.sh && go test ./internal/service/connector ./internal/infra/connector ./tests/contracts -count=1`

Expected: FAIL because Connector types and signing do not exist.

- [x] **Step 3: Implement the delegation envelope**

```go
type Delegation struct {
    Issuer                    string
    Audience                  string
    EnterpriseID              string
    ApplicationID             string
    InstanceID                string
    ActorPrincipalID          string
    AdminSessionID            string
    RequestedAction           string
    Purpose                   string
    OperationID               string
    Nonce                     string
    ExpiresAt                 time.Time
    PolicyVersion             uint64
    LifecycleVersion          uint64
    IdentitySyncVersion       uint64
    IdentityFreshnessDeadline time.Time
}
```

The maximum lifetime is 60 seconds. Human delegations cannot outlive the Identity Freshness Deadline. Connector credentials authenticate the machine channel but never substitute for the delegated actor; persistent verifier state rejects a reused nonce for the same issuer, audience and purpose even after restart.

Delegation signing private keys are loaded only through `SecretProvider`. A separate offline KeySet-root private key signs the canonical KeySet envelope and is never mounted into `ecp-api`; the online service stores and serves only the signed envelope and root public-key fingerprint. `keyset-maintain sign-and-publish` resolves the offline root through its own SecretProvider, signs locally, and submits the envelope through `PublishDelegationKeySet`; it never writes ECP tables directly. The publish endpoint verifies the configured root fingerprint/signature, monotonic version and previous chain before persistence. The versioned envelope contains `version`, `purpose`, `previous_version`, `previous_fingerprint`, key entries (`kid`, `alg`, public key, `not_before`, `not_after`, status), canonical payload hash, root `signing_kid` and root signature. Initial Connector registration returns the signed KeySet and root fingerprint over the authenticated TLS registration channel; production deployment must also pin that root fingerprint in instance configuration before accepting Delegation. A Connector fetches newer sets through `GetDelegationKeySet`, verifies the offline-root signature, monotonic version and previous-version/fingerprint chain, persists them atomically, then acknowledges the exact version and accepted `kid` values through `AckDelegationKeySet`.

Rotate by publishing the new public key, waiting until every required online Connector acknowledges it, switching signing, retaining the old verification key for at least maximum token lifetime + clock skew + key-cache TTL, then revoking the old private key. Offline Connectors remain degraded and cannot receive new signed administration work until they fetch and acknowledge the required set. Unknown `kid`, unverified key-set replacement, stale set outside its declared validity and algorithm mismatch fail closed. Emergency revocation publishes a new monotonic set version; root/fingerprint compromise requires explicit out-of-band re-bootstrap and cannot be repaired by the compromised online channel. Key generation, activation, acknowledgement, rotation, rollback and revocation are audited. Audit archive keys use a separate purpose and verifier bundle and retain historic public keys for the full audit retention period.

- [x] **Step 4: Implement product resource redaction rules**

`SearchResources` and `ResolveResource` return only resources authorized for the delegated actor. Unauthorized ID, name, and existence all use the same stable denial response.

- [x] **Step 5: Run Connector and key-distribution tests**

Run: `cd ecp && go test ./sdk/go/connector/v1 -count=1 && cd server && go test ./internal/service/connector ./internal/infra/connector -count=1`

Expected: PASS, including first root pin, invalid root signature, broken previous-fingerprint chain, key-set version rollback, Connector/browser publish rejection, missing acknowledgement, offline Connector, unknown `kid`, emergency revocation and out-of-band root re-bootstrap tests.

- [x] **Step 6: Commit the Connector contract**

```bash
git add ecp/server ecp/sdk/go
git commit -m "feat(ecp): add connector contract"
```

- [x] **Step 7: Validate the monorepo-consumable SDK boundary before ApiMind integration**

The confirmed delivery model keeps ECP in the current monorepo for this phase; do not create, push, or separately submit a canonical ECP repository or SDK tag. Task 13 may proceed after `scripts/verify-release.sh`, SDK tests, the ECP clean-copy boundary check, and an ApiMind import-boundary test prove that consumers use only `github.com/xfzen/ecp/sdk/go/connector/v1`. Root `go.work` supplies the local module; ApiMind does not add an unpublished remote requirement and no module may contain a local `replace`. `ecp/sdk/go/RELEASE.md` records publication as deliberately deferred, not as a current integration blocker. If ECP is split later, publishing and official-proxy verification become a mandatory pre-split gate before the root workspace entries are removed.

### Task 9: Add service principals, scoped credentials, rotation, and revocation

**Files:**
- Create: `ecp/server/docs/apis/credential.api`
- Create: `ecp/server/internal/domain/credential.go`
- Create: `ecp/server/internal/service/credential/service.go`
- Create: `ecp/server/internal/service/credential/service_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/credential_repo.go`
- Create: `ecp/server/migrations/{postgres,mysql}/000008_credentials.{up,down}.sql`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Produces: `CredentialService.Create`, `Rotate`, `Revoke`, `Authenticate`, and `ListUsage`.
- Raw credential material is returned once; persistence contains identifier, digest, scope, expiry, status, rotation lineage, and last use only.

- [x] **Step 1: Write one-time display and revocation tests**

```go
func TestCreateReturnsSecretOnceAndStoresDigest(t *testing.T) {
    svc, repo := newCredentialFixture(t)
    created, err := svc.Create(context.Background(), createCredentialInput())
    if err != nil || created.Secret == "" {
        t.Fatalf("create credential: %v", err)
    }
    stored := repo.get(t, created.ID)
    if stored.SecretDigest == "" || strings.Contains(stored.SecretDigest, created.Secret) {
        t.Fatal("raw secret leaked into persistence")
    }
}
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/credential -count=1`

Expected: FAIL because CredentialService does not exist.

- [x] **Step 3: Implement explicit application/instance/resource/action scopes**

Reject cross-product credentials and delegated user operations. Rotation allows a short configured overlap and then irrevocably disables the prior credential.

- [x] **Step 4: Regenerate and run credential tests**

Run: `cd ecp/server && ./scripts/gencontracts.sh && go test ./internal/service/credential ./tests/contracts -count=1`

Expected: PASS.

- [x] **Step 5: Commit service credentials**

```bash
git add ecp/server
git commit -m "feat(ecp): add service credentials"
```

### Task 10: Implement append-only audit with transactional ECP changes

**Files:**
- Create: `ecp/server/docs/apis/audit.api`
- Create: `ecp/server/internal/domain/audit.go`
- Create: `ecp/server/internal/service/audit/service.go`
- Create: `ecp/server/internal/service/audit/service_test.go`
- Create: `ecp/server/internal/service/audit/archive.go`
- Create: `ecp/server/internal/service/audit/archive_test.go`
- Create: `ecp/server/internal/infra/persistence/gorm/audit_repo.go`
- Create: `ecp/server/internal/infra/persistence/gorm/audit_connections.go`
- Create: `ecp/server/cmd/audit-maintain/main.go`
- Create: `ecp/server/config/audit.go`
- Create: `ecp/server/deploy/db/postgres/audit-roles.sql`
- Create: `ecp/server/deploy/db/mysql/audit-roles.sql`
- Create: `ecp/server/scripts/bootstrap-audit-roles.sh`
- Create: `ecp/server/migrations/{postgres,mysql}/000009_audit.{up,down}.sql`
- Create: `ecp/server/scripts/verify-audit-grants.sh`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`

**Interfaces:**
- Produces: `Audit.Intent`, `Audit.CommitWithMutation`, `Audit.Outcome`, `Audit.Ingest`, `Audit.Query`, `Audit.ExportManifest`, `Audit.ArchiveExpired`, and offline `audit-maintain export-verifier-bundle`.
- Database roles: offline `ecp_schema_owner`; online `ecp_tx_writer`, `audit_ingest_writer`, `audit_reader`; offline `audit_maintainer`.
- Runtime pools: `BusinessDB` uses `ecp_tx_writer`; `AuditIngestDB` uses `audit_ingest_writer`; `AuditReadDB` uses `audit_reader`. Each has a distinct DSN/Secret Reference and connection pool. `audit_maintainer` is accepted only by the offline `cmd/audit-maintain` configuration and is absent from online `ServiceContext`.
- Provisioning: only the offline `ECP_MIGRATION_DSN` schema owner may run the dialect-specific role/bootstrap SQL. The bootstrap consumes separately generated test/deployment secrets, creates or updates the four least-privilege accounts idempotently, applies grants, and never writes a password into migration SQL, logs or Git.

- [x] **Step 1: Write transaction, privilege, and redaction tests**

```go
func TestBusinessMutationAndCommittedAuditRollbackTogether(t *testing.T) {
    svc := newAuditFixture(t)
    err := svc.CommitWithMutation(context.Background(), operation(), func(tx *gorm.DB) error {
        if err := tx.Create(&testMutation{ID: "mutation-1"}).Error; err != nil {
            return err
        }
        return errors.New("inject rollback")
    })
    if err == nil {
        t.Fatal("expected rollback error")
    }
    assertNoMutationOrCommittedEvent(t, svc.db, "mutation-1")
}
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd ecp/server && go test ./internal/service/audit -count=1`

Expected: FAIL because audit storage does not exist.

- [x] **Step 3: Implement the three-stage audit flow**

```text
audit_ingest_writer: Intent
ecp_tx_writer transaction: Business Mutation + Change-Committed
audit_ingest_writer: Success or Failure Outcome
```

Apply a field allowlist before persistence. Secrets, tokens, cookies, private keys, document bodies, and interface bodies must not enter Safe Diff. Archival writes a signed manifest containing sequence range, event count, canonical hash, version, and signature metadata; online copies can be removed only after archive verification succeeds under `audit_maintainer`.

Construct three independent online `*gorm.DB` pools from three separately resolved secrets; never create one privileged pool and simulate separation with Repository methods. Business mutation plus Change-Committed uses the same `BusinessDB` transaction. Intent/Outcome and product ingestion use `AuditIngestDB`; queries use `AuditReadDB`. The offline `audit-maintain` command starts with no HTTP listener, resolves the maintainer secret only for the command lifetime, verifies archive signature/hash/count/sequence before cleanup, then closes its pool. It also exports a versioned audit verifier bundle containing the complete non-secret historical public-key chain required to validate retained archives. Archive signing uses its own Ed25519 purpose/key lineage, and historic public keys remain available for the full retention period.

- [x] **Step 4: Verify real PostgreSQL and MySQL grants**

Run:

```bash
cd ecp/server
./scripts/test-db-up.sh
trap './scripts/test-db-down.sh' EXIT INT TERM
. ./.run/test-db.env
ECP_DB_DRIVER=postgres ECP_MIGRATION_DSN="$ECP_TEST_POSTGRES_MIGRATION_DSN" ./scripts/bootstrap-audit-roles.sh
ECP_DB_DRIVER=postgres ./scripts/verify-audit-grants.sh
ECP_DB_DRIVER=mysql ECP_MIGRATION_DSN="$ECP_TEST_MYSQL_MIGRATION_DSN" ./scripts/bootstrap-audit-roles.sh
ECP_DB_DRIVER=mysql ./scripts/verify-audit-grants.sh
trap - EXIT INT TERM
./scripts/test-db-down.sh
```

Expected: each verification uses the role-specific DSNs generated in `.run/test-db.env`; online roles cannot update, delete or truncate `audit_event`, migration ownership is absent from all three online pools, and only the offline `audit_maintainer` can execute the versioned archive path.

- [x] **Step 5: Regenerate, test, and commit audit**

```bash
cd ecp/server
./scripts/gencontracts.sh
go test ./internal/service/audit ./internal/infra/persistence/gorm ./tests/contracts -count=1
cd ../..
git add ecp/server
git commit -m "feat(ecp): add append-only audit"
```

---

## Gate D: UI, ApiMind Integration, and Operations

### Task 11: Scaffold ecp-ui and complete admin OIDC session handling

**Files:**
- Create: `ecp/ui/package.json`
- Create: `ecp/ui/package-lock.json`
- Create: `ecp/ui/index.html`
- Create: `ecp/ui/tsconfig.json`
- Create: `ecp/ui/vite.config.ts`
- Create: `ecp/ui/src/main.tsx`
- Create: `ecp/ui/src/app/App.tsx`
- Create: `ecp/ui/src/app/routes.tsx`
- Create: `ecp/ui/src/styles/index.css`
- Create: `ecp/ui/src/styles/theme.ts`
- Create: `ecp/ui/src/api/client.ts`
- Create: `ecp/ui/src/auth/{AuthProvider,RequireSession,LoginButton,callback}.tsx`
- Create: `ecp/ui/vitest.config.ts`
- Create: `ecp/ui/playwright.config.ts`
- Create: `ecp/ui/tests/auth.test.tsx`
- Create: `ecp/ui/tests/api-boundary.test.mjs`
- Create: `ecp/ui/tests/style-boundary.test.mjs`

**Interfaces:**
- Consumes: `ecp-api` `/api/v1/auth/*` and `/api/v1/meta/*` routes.
- Produces: browser session bootstrap, callback completion, logout, expired-session handling, and an authenticated application shell.

- [x] **Step 1: Create the test harness, then write failing same-origin, session, and style-boundary tests**

Create `package.json`, the TypeScript/Vitest configuration, and the locked dependency set before application source files. Use the exact versions frozen by Gate 0 for Node/npm, React/ReactDOM 18.3.1, React Router declarative mode, Ant Design 6.4.3, `@ant-design/icons` 6.2.3, TypeScript 5.9.3, Vite, Axios, Tailwind CSS 4 and `@tailwindcss/vite`; do not use `^`, `~`, `latest` or workspace-external resolution in direct dependency declarations. Resolve all packages from the official npm registry and commit the resolved `package-lock.json`; React, ReactDOM, React Router, Ant Design, icons, and Axios are runtime dependencies, while Tailwind and build/test tools are development dependencies. Define scripts as `typecheck: tsc --noEmit`, `test:unit: vitest run`, `test:boundary: node --test tests/*.test.mjs`, `test: npm run test:unit && npm run test:boundary`, `test:e2e: playwright test`, and `build: vite build`. `verify-inputs.sh` rejects drift from `versions.lock.yaml`.

```ts
it('starts login through the same-origin ECP endpoint', async () => {
  render(<LoginButton />)
  await userEvent.click(screen.getByRole('button', { name: '登录' }))
  expect(window.location.assign).toHaveBeenCalledWith('/api/v1/auth/start')
})
```

Implement `tests/style-boundary.test.mjs` as an executable Node test that verifies package ownership, the single global stylesheet entry, disabled Preflight, no Ant Design internal-class overrides, no arbitrary color utilities, and root theme configuration:

```js
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const tsx = filesUnder(fileURLToPath(new URL('../src', import.meta.url)))
  .filter((path) => path.endsWith('.tsx'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

test('keeps Ant Design and Tailwind responsibilities separate', () => {
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert.doesNotMatch(String(version), /^(?:\^|~|>|<|latest$|workspace:|file:)/, `${name} must be exact`)
  }
  assert.equal(pkg.dependencies.antd, '6.4.3')
  assert.equal(pkg.dependencies['@ant-design/icons'], '6.2.3')
  assert.equal(pkg.dependencies['react-router'], '7.18.0')
  assert.match(pkg.devDependencies.tailwindcss, /^4\.\d+\.\d+$/)
  assert.match(pkg.devDependencies['@tailwindcss/vite'], /^4\.\d+\.\d+$/)
  assert.doesNotMatch(css, /@import\s+["']tailwindcss["']/)
  assert.match(css, /@import\s+["']tailwindcss\/theme\.css["']/)
  assert.match(css, /@import\s+["']tailwindcss\/utilities\.css["']/)
  assert.doesNotMatch(css, /preflight\.css/)
  assert.doesNotMatch(css, /\.ant-[a-z0-9-]+/i)
  assert.doesNotMatch(tsx, /(?:bg|text|border)-\[#[0-9a-f]+\]/i)
  assert.match(tsx, /className=.*\b(?:flex|grid|gap-|p-|m-|w-)/)
  assert.match(vite, /@tailwindcss\/vite/)
  assert.match(vite, /tailwindcss\(\)/)
  assert.match(app, /ConfigProvider/)
  assert.match(app, /<AntApp>/)
  assert.match(main, /BrowserRouter/)
  assert.equal((main.match(/styles\/index\.css/g) ?? []).length, 1)
})
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd ecp/ui && npm test`

Expected: FAIL because the UI scaffold does not exist.

- [x] **Step 3: Create the minimal Vite TypeScript application scaffold**

Create `index.html`, `src/main.tsx`, strict `tsconfig.json`, Vitest/jsdom setup, and Playwright configuration. `main.tsx` wraps `App` with React Router's declarative `BrowserRouter`; `src/app/routes.tsx` owns the static ECP route table. Do not adopt React Router framework mode, SSR, route plugins, YApi plugin loading, Redux compatibility, or legacy router code.

- [x] **Step 4: Configure Vite, Ant Design theme ownership, and Tailwind without Preflight**

Register the official Tailwind Vite plugin in `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Import only the Tailwind theme and utility layers in `src/styles/index.css`; do not import the aggregate `tailwindcss` entry because it includes Preflight:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

:root {
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

Import `src/styles/index.css` exactly once from `src/main.tsx` before rendering the application root.

Define the ECP product theme once and apply it at the application root:

```ts
// src/styles/theme.ts
import type { ThemeConfig } from 'antd'

export const ecpTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
  },
}
```

```tsx
// src/app/App.tsx
import { App as AntApp, ConfigProvider } from 'antd'
import { RequireSession } from '../auth/RequireSession'
import { ecpTheme } from '../styles/theme'

export function App() {
  return (
    <ConfigProvider theme={ecpTheme}>
      <AntApp><RequireSession /></AntApp>
    </ConfigProvider>
  )
}
```

Use Ant Design for controls, forms, navigation, tables, overlays, and feedback. Tailwind classes are limited to layout and small presentation utilities such as `flex`, `grid`, `gap-*`, `p-*`, `w-*`, and responsive variants. Do not apply global overrides to Ant Design internal class names.

Configure `@tailwindcss/vite` in `vite.config.ts`. To disable Preflight without disabling Tailwind itself, `src/styles/index.css` imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` explicitly and does not import the aggregate `tailwindcss` entry or `preflight.css`. The boundary test includes positive assertions for both imports, the Vite plugin and actual controlled layout utilities.

- [x] **Step 5: Implement the same-origin admin session shell**

`src/api/client.ts` creates one Axios client with `baseURL: '/api/v1'`, `withCredentials: true`, no configurable remote origin, and a request interceptor that adds the current session-bound CSRF token only to writes. `AuthProvider` loads `/auth/session`, keeps only the returned principal/session summary and CSRF token in memory, clears them on `401`, and never reads Casdoor tokens. `LoginButton` navigates to `/api/v1/auth/start`; callback completion and logout both use ECP same-origin endpoints. `RequireSession` renders the authenticated shell, an Ant Design loading state, or the login result without exposing raw server errors.

- [x] **Step 6: Enforce the browser API boundary**

The boundary test scans `src/**/*.{ts,tsx}` and fails on absolute remote business URLs, direct Casdoor management API paths, or Connector URLs. OIDC navigation may only start from `/api/v1/auth/start`.

- [x] **Step 7: Run typecheck, tests, and build**

Run:

```bash
cd ecp/ui
npm run typecheck
npm test
npm run build
cd ../..
./ecp/scripts/verify-boundary.sh
```

Expected: PASS, `dist/` contains the SPA, and SDK/server/UI pass from an ECP-only temporary copy.

- [x] **Step 8: Commit the UI foundation**

```bash
git add ecp/ui
git commit -m "feat(ecp-ui): add admin session shell"
```

### Task 12: Add ECP administration flows driven by Product Manifest

**Files:**
- Modify: `ecp/ui/src/app/routes.tsx`
- Create: `ecp/ui/src/users/{UserList,UserDetail}.tsx`
- Create: `ecp/ui/src/groups/{GroupList,GroupDetail}.tsx`
- Create: `ecp/ui/src/identity-sources/{IdentitySourceList,IdentitySyncStatus}.tsx`
- Create: `ecp/ui/src/applications/{ApplicationList,InstanceDetail}.tsx`
- Create: `ecp/ui/src/access/{RoleBindingEditor,ResourcePicker}.tsx`
- Create: `ecp/ui/src/security/{SecurityPolicy,PolicyDrift}.tsx`
- Create: `ecp/ui/src/credentials/{ServiceAccountList,CredentialRotateDialog}.tsx`
- Create: `ecp/ui/src/audit/{AuditList,AuditExport}.tsx`
- Create: `ecp/ui/src/operations/{Health,IdentitySyncStatus}.tsx`
- Create: `ecp/ui/src/api/{identity,identitySources,applications,access,security,credentials,audit}.ts`
- Create: `ecp/ui/tests/{access,audit,identity-source,security-policy,stale-identity}.test.tsx`
- Create: `ecp/server/docs/apis/admin.api`
- Modify: `ecp/server/docs/{ecp.api,apis/auth.api}` and generated routes/types/OpenAPI
- Create: `ecp/server/internal/service/adminquery/*`
- Create: `ecp/server/internal/infra/persistence/gorm/admin_query_repo.go`
- Modify: `ecp/server/api/internal/{handler,logic,svc}` for enterprise-scoped admin reads and session-bound CSRF recovery

**Interfaces:**
- Consumes: Manifest, identity, access, credential, audit, meta health, and identity-sync endpoints from Tasks 3–10.
- Produces: global user/group/identity-source management plus generic product instance, fixed role, resource grant, security policy, service account, audit, health, and identity-sync pages. Backup status is intentionally deferred until Task 16 creates the matching operation API.

- [x] **Step 1: Write failing resource visibility and stale-state tests**

```ts
it('does not render unauthorized resource names returned as denied', async () => {
  mockResourceSearch({ reason: 'resource_not_visible' })
  render(<ResourcePicker instanceId="apimind-prod" />)
  expect(await screen.findByText('无权查看该资源')).toBeVisible()
  expect(screen.queryByText('secret-project')).toBeNull()
})

it('renders directory-managed groups as read-only', async () => {
  mockGroup({ id: 'group-1', source: 'directory_managed' })
  render(<GroupDetail groupId="group-1" />)
  expect(await screen.findByRole('button', { name: '添加成员' })).toBeDisabled()
  expect(screen.getByText('由外部目录管理')).toBeVisible()
})
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd ecp/ui && npm run test:unit -- tests/access.test.tsx tests/audit.test.tsx tests/identity-source.test.tsx tests/security-policy.test.tsx tests/stale-identity.test.tsx`

Expected: FAIL because the pages do not exist.

- [x] **Step 3: Implement manifest-driven generic pages**

Render only fixed resource types, roles, actions, and capabilities declared by the accepted Manifest. Identity-source pages show provider, last successful sync, freshness deadline, lag, failure, and reconciliation state; directory-managed groups are read-only. Security pages expose only the controlled public-sharing/export/secret policy schema and policy-drift repair flow. Build tables, forms, trees, menus, pagination, dialogs, drawers, alerts, and result states with Ant Design; use Tailwind only for responsive page grids, flex layout, spacing, width, and alignment. Do not load product JavaScript or create parallel home-grown standard controls. Unsupported product settings use a controlled schema form or product deep link.

- [x] **Step 4: Implement high-risk confirmation and stable denial rendering**

Role changes, credential operations, policy repair, identity disable, audit export, and instance URL changes require reauthentication where the API reports `reauth_required`. Never expose resource existence after `resource_not_visible`.

- [x] **Step 5: Run UI verification**

Run: `cd ecp/ui && npm run typecheck && npm test && npm run build`

Expected: PASS.

- [x] **Step 6: Commit administration UI**

```bash
git add ecp/ui
git commit -m "feat(ecp-ui): add enterprise administration"
```

### Task 13: Integrate ApiMind as the first ecp-connector

**Files:**
- Create or Modify: root `go.work` and `go.work.sum`
- Modify: `server/go.mod`
- Modify: `server/go.sum`
- Modify: `server/config/config.go`
- Modify: `server/etc/apimind*.yaml`
- Create: `server/docs/apis/enterprise.api`
- Modify: `server/docs/apimind.api`
- Create: `server/internal/ecp/{client,principal,authorizer,audit,lifecycle,resource,projection}.go`
- Create: `server/internal/ecp/{client,authorizer,resource}_test.go`
- Create: `server/internal/infra/persistence/mongo/ecp_outbox_repo.go`
- Create: `server/internal/infra/persistence/mongo/ecp_projection_repo.go`
- Modify: `server/api/internal/svc/servicecontext.go`
- Modify generated: `server/api/internal/{handler,logic,types}`
- Modify: `web/client/containers/Login/Login.tsx`
- Modify: `web/client/components/Header/Header.tsx`
- Modify: `web/client/containers/Group/MemberList/MemberList.tsx`
- Modify: `web/client/containers/Project/Setting/ProjectMember/ProjectMember.tsx`
- Create: `web/tests/ecp-entry.test.mjs`
- Create: `server/tests/ecp/enterprise_mode_test.go`

**Interfaces:**
- Consumes: a pinned `github.com/xfzen/ecp/sdk/go` version plus `ecp-api` auth, authorize, lifecycle, audit, and Connector HTTP contracts; no ECP server-internal package.
- Produces: ApiMind Product Session resolution, one mode-aware Authorizer for Web/HTTP/MCP, resource directory callbacks, audit Outbox, compatibility projection, explicit `enterprise.enabled=false` community default, and minimal conditional Web entry changes.

- [x] **Step 1: Write failing ApiMind Connector tests**

```go
func TestInstanceAdminCannotDiscoverUnauthorizedProject(t *testing.T) {
    provider := newResourceFixture(t)
    results, err := provider.SearchResources(context.Background(), DelegatedSearch{
        ActorPrincipalID: "instance-admin",
        RequestedAction: "project.member.manage",
        Query: "secret",
    })
    if err != nil {
        t.Fatal(err)
    }
    if len(results) != 0 {
        t.Fatalf("unauthorized resources leaked: %+v", results)
    }
}
```

- [x] **Step 2: Run the focused tests and verify failure**

Run: `cd server && go test ./internal/ecp -count=1`

Expected: FAIL because `internal/ecp` does not exist.

- [x] **Step 3: Add the ApiMind contract fragment and regenerate using existing scripts**

Add same-origin auth start/callback/logout and Connector callback types to `server/docs/apis/enterprise.api`, import it from `server/docs/apimind.api`, then run:

```bash
cd server
./scripts/gencontracts.sh
```

Do not add a second generator or edit generated routes/types manually.

Do not add an unpublished SDK requirement or a local `replace` to `server/go.mod`. Root `go.work` uses `./server`, `./ecp/server`, and `./ecp/sdk/go`, making the monorepo build the canonical integration path for this phase. `go list -m` tests must prove ApiMind imports only `github.com/xfzen/ecp/sdk/go/connector/v1`, `GOWORK=off` must continue to pass for the copied ECP boundary, and `ecp/scripts/verify-boundary.sh` must still pass after root workspace integration. If ECP is moved to its own repository later, first publish and verify the SDK through the official Go Proxy, add that exact release to ApiMind, then remove only the ECP `use` entries; source import paths remain unchanged.

- [x] **Step 4: Implement one backend authorization entry**

```go
type Authorizer interface {
    Authorize(context.Context, Request) (Decision, error)
    BatchAuthorize(context.Context, []Request) ([]Decision, error)
}
```

Wire the Authorizer through `ServiceContext` as the only ECP authorization implementation. Task 13 constructs and wires it but does not claim full surface coverage; Task 14 makes Web, HTTP API, MCP, imports, exports, Mock, tests, and scheduled work converge on it and verifies every enterprise-capable entry point.

Introduce `enterprise.enabled` in this task, defaulting to false. With it disabled, ServiceContext wires the existing community identity/authorization behavior and makes no ECP network call; with it enabled, Product Session resolution and ECP Authorizer are mandatory and ECP outage follows the documented fail-closed/cache rules. Task 14 must preserve this mode boundary while converging protected surfaces. The time-bounded `legacy_auth_compat` migration state is added later in Task 15, but no intermediate commit may force ECP on existing deployments.

- [x] **Step 5: Implement resource versions and compatibility projection**

Workspace/project hierarchy, project access mode, and authorization root changes must alter `resource_version`. Projection writes carry an operation ID and never become an authorization source.

- [x] **Step 6: Make only the approved, mode-aware YApi Web changes**

When the same-origin server capability response reports `enterprise.enabled=false`, Login, registration and member pages retain current community behavior and no ECP entry is rendered. When enabled, Login navigates to the same-origin enterprise auth endpoint, Header links to `ecp-ui`, and old member pages become read-only summaries with an ECP deep link. Web never reads environment variables or calls ECP directly; it consumes only the Go-side capability. Do not rewrite routing, Redux, document pages, Mock, or test UI.

- [x] **Step 7: Run ApiMind backend and Web verification**

Run:

```bash
cd server
go test ./internal/ecp ./api/internal/handler/apimind ./internal/mcp -count=1
go test ./tests/ecp -run 'EnterpriseMode|CommunityMode' -count=1
./scripts/gencontracts.sh
git diff --exit-code -- docs/apimind.api api/internal/handler/routes.go api/internal/types/types.go api/openapi/v1/openapi.yaml api/mcp/v1/tools.json
cd ../web
npm run typecheck
npm test
npm run build
```

Expected: PASS; generation leaves no stale output, community mode produces no ECP call/UI change, and enterprise mode uses only same-origin integration.

- [x] **Step 8: Commit ApiMind integration**

```bash
git add server web
git commit -m "feat(apimind): integrate ecp connector"
```

### Task 14: Converge ApiMind HTTP, MCP, Mock, import/export, and background work on one Authorizer

**Files:**
- Create: `server/internal/ecp/authorization_inventory.yaml`
- Create: `server/internal/ecp/authorization_inventory.go`
- Create: `server/internal/ecp/authorization_inventory_test.go`
- Create: `server/tests/ecp/authorization_surfaces_test.go`
- Modify: `server/internal/service/group/service.go`
- Modify: `server/internal/service/project/service.go`
- Modify: `server/internal/service/interface/service.go`
- Modify: `server/internal/service/col/service.go`
- Modify: `server/internal/service/doc/{service,export}.go`
- Modify: `server/internal/service/importer/service.go`
- Modify: `server/internal/service/export/service.go`
- Modify: `server/internal/service/advmock/service.go`
- Modify: `server/internal/service/wiki/service.go`
- Modify: `server/internal/service/template/service.go`
- Modify: `server/internal/contract/{auth,service}.go`
- Modify: `server/internal/mcp/{auth,server,tools}.go`
- Modify: `server/internal/mock/{server,runner}.go`
- Modify: `server/api/internal/svc/servicecontext.go`
- Modify: every protected `server/api/internal/logic/apimind/*.go` named by `authorization_inventory.yaml` (the current pre-implementation scan finds 87 Logic files with direct Repository/collection access; Gate D re-runs the scan and records the exact generated list).
- Modify: corresponding `server/api/internal/logic/apimind/*_test.go` and protected Handler tests.
- Modify tests beside every changed service/package above.

**Interfaces:**
- Consumes: `ecp.Authorizer` and ApiMind resource/action mapping from Task 13.
- Produces: one checked inventory mapping each enterprise-capable HTTP route, MCP tool, Mock execution, import/export operation, and background mutation to `application_instance_id + actor + action + resource`; all callers use the same `(Decision, error)` contract.

- [ ] **Step 1: Write the failing authorization-surface inventory test**

```go
func TestEnterpriseAuthorizationInventoryCoversEverySurface(t *testing.T) {
    inventory := ecp.AuthorizationInventory()
    for _, surface := range discoverEnterpriseSurfaces(t) {
        mapping, ok := inventory[surface.ID]
        if !ok {
            t.Errorf("enterprise surface has no authorization mapping: %s", surface.ID)
            continue
        }
        if mapping.Action == "" || mapping.ResourceType == "" || mapping.ActorSource == "" {
            t.Errorf("incomplete authorization mapping for %s: %+v", surface.ID, mapping)
        }
    }
}
```

The discovery fixture enumerates committed go-zero routes from generated metadata, MCP tools from the generated tool manifest, all `server/api/internal/logic/apimind` files that directly access Repository/collection fields, Mock execution entry points, and the explicit import/export/background registry. `authorization_inventory.yaml` maps each surface to actor resolver, action, resource type/ID resolver, read/write class, audit class and owning business service. Public health/version/static routes are allowlisted with a reason; no unclassified route or direct data access is silently skipped.

- [ ] **Step 2: Run the inventory and cross-surface tests and verify failure**

Run: `cd server && go test ./internal/ecp ./tests/ecp -run 'AuthorizationInventory|AuthorizationSurfaces' -count=1`

Expected: FAIL and name every uncovered enterprise-capable entry point.

- [ ] **Step 3: Remove direct protected Repository access from Logic before claiming convergence**

Move each inventory-owned operation behind its named business service. Each service receives the narrow `ecp.Authorizer` interface and builds the same request shape before reading or mutating protected resources; HTTP Logic resolves input/session and calls the service only. The test scans generated Logic ASTs and fails when a protected Logic still reaches `svcCtx` Repository/collection fields directly. Existing YApi membership checks may remain only as compatibility projection and defense-in-depth; they cannot create an Allow after ECP denies. Generated Handler/routes/types remain generator-owned; regenerated thin Logic scaffolds must be reconciled through the checked inventory before commit.

- [ ] **Step 4: Enforce authorization and audit ordering on every surface**

Reads use `Resolve actor/session → Authorize → read`; high-risk writes use `Resolve actor/session → Authorize → Audit Intent → product mutation → Audit Outcome`. MCP and service credentials resolve a machine principal rather than a browser session. Mock, import, export, contract sync, document operations, and background mutations use explicit product actions instead of a generic administrator bypass.

- [ ] **Step 5: Add cross-surface equivalence and denial tests**

For the same principal/action/resource tuple, HTTP and MCP must return the same Allow/deny reason and versions. Add cases for blocked principal, stale identity, policy drift, restricted project, revoked service credential, resource-version change, and ecp-api outage. Product resource names remain absent from not-found/denied responses when `resource_not_visible` applies.

- [ ] **Step 6: Run full ApiMind authorization verification**

Run:

```bash
cd server
go test ./internal/ecp ./internal/service/... ./internal/contract ./internal/mcp ./internal/mock ./tests/ecp -count=1
go vet ./...
```

Expected: PASS; the inventory reports zero unclassified enterprise-capable surfaces and the AST scan reports zero protected direct Repository accesses in HTTP Logic.

- [ ] **Step 7: Commit authorization convergence**

```bash
git add server
git commit -m "feat(apimind): enforce ecp authorization"
```

### Task 15: Cut over legacy ApiMind authentication with a bounded rollback window

**Files:**
- Modify: `server/config/config.go`
- Modify: `server/etc/apimind*.yaml`
- Modify: `server/docs/apis/user.api`
- Modify: `server/docs/apis/enterprise.api`
- Create: `server/internal/ecp/legacyauth/{policy,migration}.go`
- Create: `server/internal/ecp/legacyauth/{policy,migration}_test.go`
- Modify: legacy registration/password/LDAP/login/session Logic and Handler files named by the auth inventory.
- Modify: `web/client/containers/Login/Login.tsx`
- Create: `server/tests/ecp/legacy_auth_cutover_test.go`
- Create: `docs/runbooks/ecp-legacy-auth-cutover.md`

**Interfaces:**
- Consumes: ECP Product Session resolution, `legacy_identity_mapping`, current ApiMind login/session routes, and Task 14 authorization convergence.
- Produces: explicit community/enterprise mode, a time-bounded compatibility switch, audited migration metrics, deterministic rollback before cutoff, and permanent old-session rejection after cutoff.

- [ ] **Step 1: Write the cutover state-machine tests**

Test `enterprise.enabled=false`; enterprise mode with compatibility off; compatibility on; dual Cookie conflict; old session for an unmapped, blocked or revoked user; expiry; rollback before cutoff; and attempted rollback after irreversible cutoff. Enterprise denial must always win over legacy membership or Cookie state.

- [ ] **Step 2: Add explicit configuration and safe defaults**

Retain the `enterprise.enabled=false` community default established in Task 13. When enterprise mode is true, registration, local password login and LDAP login are disabled unless `enterprise.legacy_auth_compat=true` is explicitly set. A deadline is required and validated only while compatibility is enabled; startup rejects compatibility with a missing/past deadline or a window longer than the earlier of 30 days and one ApiMind minor release. After cutoff, compatibility is false and no legacy deadline is required. There is no silent fallback to old auth when ECP is unavailable.

- [ ] **Step 3: Migrate identities and operate the bounded dual-session window**

Preflight inventories active users/sessions, requires stable `legacy_identity_mapping`, and writes no raw credentials. During compatibility, every old-session use is audited and counted, responses carry deprecation metadata, and ECP lifecycle/authorization still decides access. Product and legacy Cookies use distinct names; if both exist, the Product Session identity must match the mapped legacy identity or both are rejected and revoked.

- [ ] **Step 4: Enforce removal and rollback conditions**

Cutoff requires 14 continuous days with no successful legacy-session use, all active users mapped, no unresolved identity conflict, and passing cutover tests. Before cutoff, rollback can restore the previous login UI/config while preserving mappings and audit. After cutoff, old endpoints return stable `legacy_auth_disabled`, Web removes old entry points, and rollback means restoring from the documented release/data backup—not re-enabling an expired hidden bypass. Historical YApi User documents remain for authorship.

- [ ] **Step 5: Verify and commit the cutover**

```bash
cd server
./scripts/gencontracts.sh
go test ./internal/ecp/legacyauth ./tests/ecp -run 'LegacyAuth|Cutover|DualSession' -count=1
cd ../web
npm run typecheck && npm test && npm run build
```

Expected: all modes and cutoff/rollback boundaries pass; enterprise mode has no unconfigured legacy fallback.

```bash
git add server web docs/runbooks/ecp-legacy-auth-cutover.md
git commit -m "feat(apimind): cut over enterprise authentication"
```

### Task 16: Add deployment, backup, restore, and upgrade verification

**Files:**
- Create: `ecp/deploy/compose.yaml`
- Create: `ecp/deploy/.env.example`
- Create: `ecp/deploy/README.md`
- Create: `ecp/scripts/verify-standalone.sh`
- Create: `ecp/server/scripts/{backup,restore,preflight,dev-start,dev-stop}.sh`
- Create: `ecp/server/internal/service/operation/{export,offboard}.go`
- Create: `ecp/server/internal/service/operation/{export,offboard}_test.go`
- Create: `ecp/server/tests/operations/{backup_restore,compose}_test.go`
- Create: `ecp/ui/src/operations/BackupStatus.tsx`
- Create: `ecp/ui/src/api/operations.ts`
- Create: `ecp/ui/tests/backup-status.test.tsx`
- Modify: `ecp/server/docs/apis/operation.api`
- Modify: `ecp/server/docs/ecp.api`
- Modify generated: `ecp/server/api/internal/{handler,logic,types}`
- Modify: `deploy/docker-compose.dev.yml`
- Modify: root `Makefile`
- Modify: `docs/quick-start.md`

**Interfaces:**
- Produces: supported local ECP stack, coordinated backup manifest and status API/UI, empty-environment restore, version/space/connectivity preflight, portable enterprise metadata export, product-instance offboarding, and ApiMind app-dev integration.

- [ ] **Step 1: Write failing Compose and restore-policy tests**

```go
func TestComposeUsesSeparateDatabases(t *testing.T) {
    compose := loadCompose(t)
    assertDatabaseName(t, compose, "casdoor", "casdoor_db")
    assertDatabaseName(t, compose, "ecp-api", "ecp_db")
    assertNoSharedCredential(t, compose, "casdoor", "ecp-api")
}

func TestOffboardRevokesSessionsAndCredentialsBeforeDisconnect(t *testing.T) {
    svc := newOffboardFixture(t)
    result, err := svc.OffboardInstance(context.Background(), "apimind-prod")
    if err != nil {
        t.Fatal(err)
    }
    if !result.SessionsRevoked || !result.CredentialsRevoked || !result.ExportVerified {
        t.Fatalf("unsafe offboard result: %+v", result)
    }
}

func TestDevRestartUsesValidatedPIDFilesInsteadOfBroadKill(t *testing.T) {
    script := readRepositoryFile(t, "ecp/server/scripts/dev-stop.sh")
    assertContainsAll(t, script, ".run/ecp-api.pid", ".run/ecp-ui.pid", "ps -p")
    assertContainsNone(t, script, "pkill", "killall")
}
```

- [ ] **Step 2: Run operations tests and verify failure**

Run: `cd ecp/server && go test ./tests/operations -count=1`

Expected: FAIL because deployment files do not exist.

- [ ] **Step 3: Add the low-threshold deployment**

The stack includes Casdoor, `ecp-api`, `ecp-ui`, one PostgreSQL or MySQL engine with distinct databases/accounts, and reverse-proxy routes. Local defaults bind ECP UI to `127.0.0.1:4001` and ECP API to `127.0.0.1:18890`; existing ApiMind Web `4000`, app-dev API `18889`, and embedded API `18888` do not change. `dev-start.sh` first invokes `dev-stop.sh`; stop uses checkout-local `.run/ecp-api.pid` and `.run/ecp-ui.pid`, validates each live PID command belongs to this checkout and expected component, then terminates that PID. It never uses broad `pkill`, `killall`, or an unresolved port match. Docker starts use `--remove-orphans`. No real secret is committed; `.env.example` uses documented example values and secret-file references.

- [ ] **Step 4: Implement coordinated backup and empty restore**

The manifest records component versions, database engine/version, backup timestamps, file hashes, encryption metadata, and restore order. A backup is not accepted until the test restores Casdoor, ECP, and an ApiMind fixture into an empty environment and validates mappings, policies, audit sequence, and product resources.

Only after the operation contract exists, add `GET /api/v1/operations/backup/status`, `src/api/operations.ts`, `BackupStatus.tsx` and its UI test. The page renders verified/failed/in-progress/never-run states from the same-origin API and never infers success from file existence.

- [ ] **Step 5: Implement portable export and safe product offboarding**

The export contains enterprise/application/instance metadata, stable identity mappings, accepted Manifest versions, policy references and canonical hashes, credential metadata without raw secrets, and an audit export manifest. Offboarding first creates and verifies that export, blocks new sessions, revokes product sessions and all instance credentials, flushes audit/outbox work, records the final lifecycle version, and only then disables the Connector registration. Retention status remains explicit; offboarding never deletes product resources or databases.

- [ ] **Step 6: Run preflight and operations tests**

Run:

```bash
cd ecp/server
./scripts/gencontracts.sh
./scripts/preflight.sh
go test ./tests/operations -count=1
docker compose -f ../deploy/compose.yaml config
cd ../..
./ecp/scripts/verify-standalone.sh
```

Expected: PASS. `verify-standalone.sh` copies only `ecp/` to a clean temporary directory and runs pinned input verification, SDK/server tests, contract regeneration, UI install/typecheck/test/build, both migration dialects and Compose configuration without reading parent ApiMind files.

- [ ] **Step 7: Commit the deployable ECP boundary and ApiMind glue as monorepo phases**

```bash
git add ecp
git commit -m "feat(ecp): add deploy and recovery workflow"
git add deploy/docker-compose.dev.yml Makefile docs/quick-start.md
git commit -m "feat(apimind): add ecp local integration"
```

The first commit contains the deployable ECP boundary and must pass `verify-standalone.sh`; the second contains ApiMind integration. Both remain ordinary commits in this monorepo. Do not create, push, or separately submit an ECP repository in this phase. The path separation preserves reviewability and makes a later, explicitly approved extraction possible without making extraction part of G0 delivery.

### Task 17: Execute the G0 acceptance matrix and close documentation

**Files:**
- Create: `ecp/server/tests/e2e/ecp_g0_test.go`
- Create: `ecp/ui/tests/e2e/ecp-g0.spec.ts`
- Create: `server/tests/ecp/apimind_g0_test.go`
- Create: `docs/test-reports/ecp-g0-acceptance.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-08-23-enterprise-control-plane-spec.md`
- Modify: `docs/superpowers/specs/2026-08-23-apimind-enterprise-connector-profile-spec.md`

**Interfaces:**
- Consumes: the passing Gate 0 report and all prior Gate A–D deliverables.
- Produces: reproducible G0 evidence for identity, authorization, Connector isolation, audit, dual-dialect migration, UI, backup/restore, and ApiMind compatibility.

- [ ] **Step 1: Encode the acceptance scenarios as executable tests**

Cover at minimum:

```text
Casdoor login and stable principal mapping
blocked/pending/stale denial precedence
workspace/project inheritance and restricted project
policy drift denies read and resource discovery
Connector confused-deputy and cross-instance rejection
service credential scope, rotation, and revocation
append-only audit and transactional Change-Committed
PostgreSQL/MySQL migration and rollback
coordinated empty restore
ApiMind Web/HTTP/MCP authorization consistency
```

- [ ] **Step 2: Run the complete ECP server verification**

Run: `cd ecp/server && ./scripts/verify.sh`

Expected: PASS and a clean `ecp/server` worktree.

- [ ] **Step 3: Run the complete ECP UI verification**

Run: `cd ecp/ui && npm run typecheck && npm test && npm run test:e2e && npm run build`

Expected: PASS.

- [ ] **Step 4: Run the ApiMind compatibility verification**

Run:

```bash
cd server
go test ./...
go vet ./...
cd ../web
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run live browser smoke against the composed stack**

Validate login, user disable, role assignment, unauthorized resource hiding, service credential rotation, audit query/export, and ApiMind document/interface workflows in the current Chrome session. Record concrete timestamps, versions, failures, screenshots, and recovery results in `docs/test-reports/ecp-g0-acceptance.md`.

- [ ] **Step 6: Reconcile Spec status with evidence**

Only mark a G0 acceptance item complete when the report links a passing command or live-smoke result. If runtime evidence contradicts Gate 0 or makes a mandatory Casdoor event/group assumption unknown again, reopen Gate 0 and stop acceptance; mandatory uncertainty cannot remain in a completed G0.

- [ ] **Step 7: Commit acceptance evidence without collapsing repository boundaries**

```bash
git add ecp
git commit -m "test(ecp): verify standalone g0 acceptance"
git add server web docs
git commit -m "test(ecp): verify g0 acceptance"
```

## Spec Coverage Matrix

| Confirmed requirement | Implemented by | Gate evidence |
| --- | --- | --- |
| Feasibility proven and every official build/runtime input frozen | Task 0 | Casdoor/Casbin, dialect, N/N-1, backup/restore prototypes, standalone validation bundle and `versions.lock.yaml` verification |
| ECP is independently buildable and its public Connector SDK keeps stable module paths after extraction | Tasks 1, 8, 13, 16 and 17 | monorepo workspace consumption without `replace`, ECP-only clean-directory build, module-boundary scan, SDK contract/signature tests; official-proxy release verification is a future pre-split gate |
| Independent `ecp-api`, deterministic go-zero contracts, thin Handler/Logic | Tasks 1–3 | repeated generation diff, build, registry contract tests |
| Separate `ecp_db`, PostgreSQL/MySQL compatibility, reversible migrations | Tasks 2–10, 16 | both dialects run up/down/up and empty restore |
| Casdoor adapter, explicit OIDC clients, PKCE, exact redirects, no production DCR | Tasks 4 and 6 | adapter, router, callback, replay, and cookie-boundary tests |
| Stable issuer+subject identity, JIT restrictions, managed/directory groups, freshness denial | Task 5 | identity, group-source, sync deadline, and lifecycle tests |
| One authorization sequence, Casbin projection, drift fail-close, versioned cache | Task 7 | ordering, drift, restricted-resource, cache-version, and stale-Allow tests |
| Versioned Connector, separate trust channels, signed actor delegation, key-set acknowledgement, resource redaction | Task 8 | initial pin, version rollback, offline acknowledgement, rotation/revocation, audience, nonce, expiry, confused-deputy and visibility tests |
| Scoped machine identities, one-time secret display, rotation and revocation | Task 9 | digest-only persistence, scope, overlap, expiry, and revocation tests |
| Append-only audit, writer separation, transactional ECP events, signed archive | Task 10 | PostgreSQL/MySQL grants, rollback, redaction, archive verification |
| Shared React + Ant Design + Tailwind CSS + Vite administration UI | Tasks 11 and 12 | same-origin, session, style-boundary, manifest, stale-state, and build tests |
| Minimal ApiMind Connector and Web entry integration without YApi Web rewrite | Task 13 | workspace SDK boundary, Connector, generation, resource, projection, community/enterprise mode and minimal Web tests |
| One ApiMind authorization path across HTTP/MCP/Mock/import/export/background work | Task 14 | complete surface inventory and cross-surface decision equivalence tests |
| Bounded legacy-auth migration with no silent enterprise fallback | Task 15 | mode, dual-session, deadline, cutoff and rollback tests |
| Low-threshold deployment, latest-instance-only local start, backup/restore, export/offboarding | Task 16 | Compose policy, validated PID handling, preflight, empty restore, export/offboard and BackupStatus tests |
| Full G0 product and live-browser acceptance | Task 17 | command-linked report and live smoke evidence |

## Final Verification Gate

Run from the repository root:

```bash
git diff --check
./ecp/scripts/verify-inputs.sh
./ecp/scripts/verify-standalone.sh
cd ecp/server && ./scripts/verify.sh
cd ../ui && npm run typecheck && npm test && npm run test:e2e && npm run build
cd ../../server && ./scripts/verify.sh
cd ../web && npm run typecheck && npm test && npm run build
cd .. && git status --short
```

Expected:

- every command exits 0;
- generation is deterministic;
- PostgreSQL and MySQL migration tests pass;
- no generated file is stale;
- no product or browser code directly accesses ECP/Casdoor databases or remote business APIs;
- `git status --short` is empty after the planned commits.
