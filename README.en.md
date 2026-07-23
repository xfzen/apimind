# ApiMind

[中文](README.md)

## Overview

ApiMind is a self-hosted, API-first, YApi-compatible platform for developers
and AI agents. The independently versioned Headless ApiMind Server provides the
runtime, Web provides the browser experience, and Skills provides Codex/MCP
integration.

This repository is the canonical product, source integration, documentation,
and distribution workspace:

```text
apimind/
├── web/       # Apache-2.0 WebUI maintained in this repository
├── skills/    # Apache-2.0 Codex plugin maintained in this repository
└── server/    # BUSL-1.1 submodule pinned to a public commit
```

## Core Capabilities

- YApi-compatible project, interface, and documentation HTTP APIs;
- HTTP Mock and test-collection execution;
- MCP HTTP contract integration;
- OpenAPI 3.0.3 contracts;
- MongoDB 7.0.37 storage.

## Relationship with YApi and Major Differences

ApiMind Web is developed from YApi Web and preserves the familiar project,
interface, Mock, and test-collection workflows. ApiMind Server is not a direct
port of the original YApi Node.js backend; it is an independently implemented
Go service that supports Web and other clients through YApi-compatible APIs.

Here, "YApi-compatible" means compatibility with the protocols and data model
used by YApi Web:

| Compatibility area | How ApiMind provides compatibility |
| --- | --- |
| HTTP APIs | Retains the main `/api/*` and `/mock/*` paths and their request and response conventions |
| Responses and authentication | Retains the `errcode`, `errmsg`, and `data` response envelope and the `_yapi_token` and `_yapi_uid` cookie conventions |
| MongoDB data | Retains the main collections, BSON fields, numeric IDs, and `identitycounters` to support continuity and migration of existing YApi data |
| Web and Mock | Supports the project, interface, documentation, test-collection, and HTTP Mock flows required by the current ApiMind Web |

Compatibility does not mean coverage of every historical YApi API, arbitrary
Node.js third-party plugins, or every deployment configuration, and it is not
a promise that every YApi installation can be replaced without migration.
The exact supported surface is defined by the Server
[compatibility route manifest](https://github.com/xfzen/apimind-server/blob/dev/api/compatibility/v1/routes.yaml),
[API versioning and compatibility policy](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.en.md), and
[YApi API completeness matrix](https://github.com/xfzen/apimind-server/blob/dev/docs/audits/yapi-api-completeness-matrix.md).

The YApi column below refers to the Web baseline recorded by this repository's
migration documents, not every later YApi release.

| Area | YApi Baseline | ApiMind |
| --- | --- | --- |
| Application architecture | Web and the Node.js server lived in one codebase | Web is an independent browser client; authentication, storage, and business APIs are provided by the Headless Go Server |
| Frontend stack | React 16, Ant Design 3, and Webpack 2 | React 18, Ant Design 6, and Vite 5, with explicit compatibility layers for retained pages |
| Documentation experience | Primarily interface documentation and the Wiki plugin | Adds project and workspace documentation workbenches with a document tree, table of contents, Markdown editing, preview, and split view |
| Project reuse | Primarily standard projects and interface-template settings | Adds template projects, template documents, and editing flows |
| Import, export, and plugins | Common capabilities were mainly injected through runtime plugins | Builds in common import and export capabilities and uses an explicit registry for retained, migrated, or disabled plugins |
| Build and deployment | Frontend builds were coupled to the historical Node.js server release flow | Server and Web build on the host; an Nginx runtime image packages Web output without compiling source in Docker |
| Security and quality | Dependency and quality controls were distributed across the historical build chain | Adds dependency-security, content-sanitization, repository-boundary, build-output, container-configuration, and CI gates |

See the [detailed comparison](web/docs/changes-from-yapi.md) (Chinese) for
implementation impacts, compatibility boundaries, and source references. The
English modification summary, lineage, and licensing boundaries are available
in [`web/MODIFICATIONS.md`](web/MODIFICATIONS.md) and
[`web/MIGRATION.md`](web/MIGRATION.md).

## Components

| Component | Role | License |
| --- | --- | --- |
| [`server/`](server/) | Independently versioned Headless/API-first Runtime Core | BUSL-1.1 source-available + commercial license |
| [`web/`](web/) | YApi-compatible browser experience | Apache-2.0 |
| [`skills/`](skills/) | Codex/MCP project configuration and contract maintenance | Apache-2.0 |

## Quick Start

Requirements: Go 1.25.12, Node.js 22, npm 10+, and Docker. Use only official
publisher sources for downloads.

```bash
git clone --recurse-submodules https://github.com/xfzen/apimind.git
cd apimind
cp .env.example .env
make dev
```

Server and Web are compiled on the host; Docker only runs MongoDB and packages
the runtime images. Open `http://127.0.0.1:4000`, register or sign in, and
create a minimal workspace, project, and interface. The development Server
port is `127.0.0.1:18889`.

See the [English Quick Start](docs/quick-start.en.md) for the complete flow.

## Documentation

Start with the [English documentation index](docs/README.en.md) for Quick
Start, architecture, components, compatibility, capability matrix, ecosystem,
and Roadmap. The [Chinese index](docs/README.md) is also available.

## Roadmap

Roadmap items express direction and have no promised delivery dates. See
[Roadmap](docs/roadmap.en.md).

## Community and Security

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions and
[SECURITY.md](SECURITY.md) for security reports.

## License

Root files, Web, and Skills are available under Apache-2.0. The Server
submodule is excluded from the root license and is source-available under
BUSL-1.1 with commercial licensing available. See
[`LICENSING.md`](LICENSING.md).
