# Quick Start

[中文](quick-start.md)

## Goal

Start the official MongoDB 7.0.37 image, the pinned ApiMind Server, and ApiMind
Web from the unified repository, then complete the minimal browser workflow.
PostgreSQL remains Roadmap.

## Requirements

- Go 1.25.12;
- Node.js 22;
- npm 10+;
- Docker;
- available ports: Server `127.0.0.1:18889` and Web `127.0.0.1:4000`.
  MongoDB is reachable only inside the Compose network.

All software, toolchains, dependencies, and container images must come from
official upstream or publisher-maintained registries.

## 1. Clone and initialize

```bash
git clone --recurse-submodules https://github.com/xfzen/apimind.git
cd apimind
cp .env.example .env
make bootstrap
```

If the repository was cloned without submodules, `make bootstrap` checks out
the exact Server commit pinned by the workspace.

The local development account in `.env.example` is:

| Setting | Default example value |
| --- | --- |
| Username | `admin@example.invalid` |
| Password | `change-me-local-only` |

Change these values in `.env` before the first startup. `.env` is ignored by
Git; never commit real credentials.

## 2. Start the development stack

```bash
make dev
```

Server and Web are compiled on the host with the official Go and npm
toolchains. Docker only runs MongoDB and packages the host-built artifacts into
minimal runtime images.

The Compose project name is fixed to `apimind-public`, so it does not
automatically reuse MongoDB volumes from an older workspace or YApi
installation. Migrate existing data through MongoDB's official cross-version
upgrade procedure; do not attach an old volume directly to MongoDB 7.0.37.

Verify Server:

```bash
curl http://127.0.0.1:18889/api/ping
```

Show workspace versions and the pinned commit:

```bash
make status
```

## 3. Browser verification

Open `http://127.0.0.1:4000`, sign in with the account from `.env` or register a
new account, then:

1. create a workspace;
2. create a project;
3. create an interface;
4. reopen it and confirm that its name, path, and request method are displayed correctly.

Follow logs and stop the stack with:

```bash
make logs
make down
```

Run `make reset-integration` only when local MongoDB data should be deleted.
