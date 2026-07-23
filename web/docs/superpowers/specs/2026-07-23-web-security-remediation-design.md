# ApiMind Web Security Remediation Design

Date: 2026-07-23

## Objective

Remediate the ApiMind Web production dependency graph and runtime image until
both the tracked Web filesystem and `apimind-web:local` report zero HIGH and
zero CRITICAL vulnerabilities. Preserve existing browser behavior, API
contracts, YApi compatibility, and the host-build/runtime-only Docker
boundary.

## Confirmed Scope

- Do not modify the PC App, Server business behavior, Skills, API contracts,
  request paths, response shapes, or storage choices.
- Do not scan Git history.
- Do not use subagents.
- Download packages, tools, vulnerability databases, and container images only
  from official upstream sources or publisher-maintained registries.
- Build Web assets on the host. Docker may only package the prebuilt `dist`
  directory and Nginx configuration.
- Do not add vulnerability ignores, risk acceptances, scanner exemptions, or
  dependency classifications that conceal production findings.

## Current Evidence

The baseline was reproduced with the digest-pinned official Trivy 0.70.0
container and the official `ghcr.io/aquasecurity/trivy-db:2` database. The
tracked Web tree reports 59 HIGH and 23 CRITICAL findings across 20 production
package families.

The largest direct risks are:

- `vm2` 3.10.0: 18 CRITICAL and 5 HIGH findings; no Web source imports it.
- `axios` 0.18.1: 21 HIGH findings and broad use across browser requests.
- `jsrsasign` 8.0.24: 2 CRITICAL and 6 HIGH findings.
- `crypto-js` 3.3.0 and `sha.js` 2.4.9: one CRITICAL finding each.
- old `underscore`, `json5`, Markdown, schema, and Swagger dependency chains
  that retain additional HIGH findings.
- `mockjs` 1.0.1-beta3 and the `string` package have findings without a fixed
  version for the installed release; their supported parent packages must be
  upgraded so those releases leave the production graph.

The previous split verification recorded 35 HIGH and 2 CRITICAL findings in
the Web runtime image. The runtime is based on a digest-pinned Nginx 1.27
Alpine image and must be refreshed independently of the JavaScript graph.

Online `npm audit` is not part of the evidence path because it uploads the
project dependency graph to the registry. Trivy downloads only the public
vulnerability database and scans the repository locally.

## Selected Approach

Use a targeted production-graph remediation rather than minimum-only patching
or a wholesale frontend migration.

1. Remove the unused direct `vm2` dependency.
2. Upgrade vulnerable direct dependencies to current official supported
   releases, including Axios, CryptoJS, jsrsasign, sha.js, Underscore, JSON5,
   Mock.js, Markdown-It and its plugins, schema tooling, and other parents that
   own vulnerable transitive packages.
3. Prefer upgrading the owning parent package. Use an exact npm `overrides`
   entry only when a compatible parent has no release that selects the fixed
   transitive version.
4. Refresh the official Nginx Alpine runtime image and pin the selected image
   by immutable digest.
5. Add repository-owned dependency policy tests so known unsafe floors cannot
   silently return before Trivy runs.

This approach minimizes behavior changes while removing unsupported or
vulnerable packages from the actual production lock graph. A framework or
build-system migration is explicitly out of scope.

## Dependency and Compatibility Boundaries

`package.json` and `package-lock.json` remain the authoritative dependency
inputs. Every package is resolved through `https://registry.npmjs.org`.

For direct upgrades with a major-version transition, retain the existing call
sites unless tests prove an incompatibility. In particular:

- Axios continues to receive relative URLs, request bodies, query parameters,
  and response objects through the existing Go-side API boundary. Web code
  must not start calling remote business APIs directly.
- CryptoJS and jsrsasign continue to expose the algorithms used by Postman
  script compatibility and power-string helpers.
- Mock.js continues to support the current advanced-mock and mock-editor
  behavior.
- Markdown and schema upgrades must preserve heading extraction, document
  rendering, Swagger import, Postman import, and schema editor behavior.

If an upgraded API is incompatible, add the smallest local adapter at the
existing call boundary and cover it with a focused regression test. Do not
perform unrelated refactoring.

## Security Gate

Add `tests/security-baseline.test.mjs` and run it from the Web verification
script before the functional suite. The test reads `package.json` and
`package-lock.json` and enforces:

- approved minimum versions for security-sensitive direct dependencies;
- absence of `vm2` from direct dependencies and the selected production graph;
- absence of the vulnerable `string` release and pre-stable Mock.js release;
- fixed floors for vulnerable transitive packages that remain selected;
- continued use of the official npm registry in lockfile `resolved` URLs.

The test is a fast regression gate, not a replacement for Trivy. The final
Trivy filesystem and image reports are authoritative for the zero-finding
acceptance criterion.

## Runtime Image

Select the current publisher-maintained official Nginx Alpine image, pull it
from Docker Hub, record its repository digest, and pin that digest in
`Dockerfile`. The Dockerfile retains only:

- the digest-pinned Nginx runtime base;
- `COPY deploy/nginx.conf`;
- `COPY dist`;
- the existing port and Nginx command.

No Node.js toolchain, package manager, source tree, or compilation step may be
added to the image.

## Verification

Use red-green TDD for the dependency policy:

1. Add the security baseline test and prove it fails against the current lock
   graph for the expected unsafe dependencies.
2. Apply one dependency-family upgrade at a time and keep focused compatibility
   tests green.
3. Run the complete Web verification: lint, structural tests, 36 AVA tests,
   schema-editor smoke, host Vite build, and runtime-container smoke.
4. Run parent workspace component-pin, App-tree, and integration verification.
5. Scan the tracked Web snapshot and exported runtime image locally with the
   fixed Trivy container and current official database.

Completion requires:

- Web filesystem: `0 HIGH / 0 CRITICAL`;
- `apimind-web:local`: `0 HIGH / 0 CRITICAL`;
- no security ignore or risk acceptance;
- no runtime or contract regression;
- clean Web and parent working trees after commits.

If any package family cannot reach zero without a behavior-breaking migration,
stop and report the exact package, advisory, dependency path, and migration
boundary instead of weakening the gate.

## Delivery

Commit Web changes on `codex/web-security-remediation`. After Web verification,
update the parent gitlink, compatibility metadata, and only the Web rows of the
migration security report. Push only after the user explicitly requests it.
