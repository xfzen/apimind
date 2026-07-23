# ApiMind Web

[中文](README.md)

## Overview

ApiMind Web is ApiMind's standalone browser client, evolved from YApi Web. It provides browser workflows for interface management, documentation, Mock, test collections, and project collaboration, while the ApiMind Go service owns authentication, storage, and business APIs.

## Role in ApiMind

Web owns only the browser experience. Browser code does not call remote ApiMind, YApi, or business APIs directly: Vite proxies same-origin requests to the Go service in development, and production uses the site's same-origin endpoint or a build-time Go service endpoint.

## Current Capabilities

- YApi-compatible workspace, project, interface, and documentation screens;
- HTTP Mock and test-collection interactions;
- login, registration, and business-data access through the Go service;
- independent host builds and static-site runtime configuration.

The current Web source and Server contracts are the authority for behavior.

## Major Changes and Improvements

ApiMind Web preserves YApi Web's core interaction model while continuously improving independent deployment, frontend modernization, security, and product capabilities.

| Area | YApi Baseline | ApiMind Web |
| --- | --- | --- |
| Application architecture | Browser frontend and the historical Node.js server lived in one repository | Independent browser client; authentication, storage, and business APIs are provided by ApiMind Go Server, while the browser uses only same-origin requests or the local development proxy |
| Frontend stack | React 16, Ant Design 3, Webpack 2, and legacy module compatibility layers | React 18, Ant Design 6, and Vite 5, with ESM, icon, form, styling, and CommonJS interoperability adaptations |
| Documentation experience | Primarily interface documentation and the Wiki plugin | Adds project and workspace documentation workbenches with a document tree, table of contents, preview, editing, split view, heading navigation, and synchronized scrolling |
| Project reuse | Primarily standard projects and interface template settings | Adds template-project entry points, navigation, template documents, and editing flows as a foundation for standardized project initialization |
| Import, export, and plugins | Common capabilities were dynamically injected through runtime plugins | Builds in Postman, HAR, Swagger, and YApi JSON import, data export, and Gen Services settings, with an explicit registry for retained or disabled plugins |
| Security | Included many historical dependencies that are no longer maintained, with dispersed security controls | Upgrades security-sensitive dependencies and adds prototype-safe Mock.js, content sanitization, input validation, official npm download enforcement, and automated security baselines |
| Build and deployment | The build chain was coupled to the historical server and production assets were kept under `static/prd/` | Vite creates an ignored `dist/` on the host; the Nginx runtime image packages existing output and does not compile Web inside Docker |
| Engineering quality | Relied mainly on legacy unit tests and build workflows | Adds CI gates for documentation, repository boundaries, dependency security, editor contracts, build output, container configuration, and current-snapshot integrity |

See [MODIFICATIONS.md](MODIFICATIONS.md), [MIGRATION.md](MIGRATION.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for detailed lineage, licensing boundaries, and modification notes.

## Requirements

- Node.js 22;
- npm 10 or newer;
- an ApiMind Go service running at `127.0.0.1:8888`.

## Quick Start

Start the local Go service using the [ApiMind Server documentation](https://github.com/xfzen/apimind-server), then run:

```bash
npm ci --registry=https://registry.npmjs.org
YAPI_API_TARGET=http://127.0.0.1:8888 npm run dev
```

Open `http://127.0.0.1:4000`. `YAPI_API_TARGET` configures only the Vite development proxy; browser code still requests same-origin paths such as `/api` and `/mock`.

## Configuration

- `YAPI_API_TARGET`: development proxy target; defaults to `http://127.0.0.1:8888`;
- `YAPI_API_BASE`: Go service endpoint injected during a host production build; empty means same-origin;
- `dist/`: ignored production build output.

## Documentation

Start with the [English documentation index](docs/README.en.md) for development, migration, security, licensing, and historical material. The [Chinese index](docs/README.md) is also available.

## Development and Verification

```bash
npm run lint
npm test
npm run smoke:schema-editor
YAPI_API_BASE= npm run build
```

All frontend compilation runs on the host or in CI. The Dockerfile only packages an existing `dist/`; it does not compile Web inside Docker.

To run the container image, complete the host build above first, then package only the existing `dist/`:

```bash
docker build -t apimind-web .
docker run --rm -p 8080:8080 apimind-web
```

## Security

Read [SECURITY.md](SECURITY.md). Do not put credentials, remote business endpoints, or logic that bypasses the Go service into browser code.

## License

ApiMind Web is available under [Apache-2.0](LICENSE). It is derived from [YMFE/YApi](https://github.com/YMFE/yapi); see [NOTICE](NOTICE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and [MODIFICATIONS.md](MODIFICATIONS.md) for original copyright, third-party components, and ApiMind changes. This project is independently maintained and is not affiliated with, sponsored by, or endorsed by YMFE or the official YApi project.
