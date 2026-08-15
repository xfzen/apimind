COMPOSE ?= docker compose
COMPOSE_ENV ?= .env
COMPOSE_BASE = $(COMPOSE) --env-file $(COMPOSE_ENV) -f deploy/docker-compose.yml
COMPOSE_DEV = $(COMPOSE_BASE) -f deploy/docker-compose.dev.yml

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show the ApiMind workspace commands.
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: bootstrap
bootstrap: ## Initialize the pinned Server submodule and local Web compatibility alias.
	sh scripts/bootstrap.sh

.PHONY: status
status: ## Show the workspace versions and pinned Server commit.
	sh scripts/component-status.sh

.PHONY: config
config: ## Validate production and development Compose configuration.
	@test -f $(COMPOSE_ENV) || cp .env.example $(COMPOSE_ENV)
	$(COMPOSE_BASE) config >/dev/null
	$(COMPOSE_DEV) config >/dev/null

.PHONY: build-server
build-server: bootstrap ## Compile the Linux Server binary on the host.
	$(MAKE) -C server build VERSION=0.1.0

.PHONY: web-install
web-install: ## Install locked Web dependencies from the official npm registry.
	@test -x web/node_modules/.bin/vite && test -e web/node_modules/@apimind/mockjs-safe || \
		(cd web && npm ci --no-audit --registry=https://registry.npmjs.org)

.PHONY: build-web
build-web: web-install ## Compile Web assets on the host.
	cd web && npm run build

.PHONY: build-components
build-components: build-server build-web ## Build Server and Web inputs on the host.

.PHONY: dev
dev: config bootstrap build-components ## Start MongoDB, Server, and Web on development ports.
	APIMIND_WEB_PORT=4000 $(COMPOSE_DEV) up -d --build --remove-orphans

.PHONY: up
up: config bootstrap build-components ## Start the production-shaped local stack.
	$(COMPOSE_BASE) up -d --build --remove-orphans

.PHONY: down
down: ## Stop the stack while preserving MongoDB data.
	$(COMPOSE_DEV) down --remove-orphans

.PHONY: logs
logs: ## Follow MongoDB, Server, and Web logs.
	$(COMPOSE_DEV) logs -f --tail=200 mongo server web

.PHONY: test-docs
test-docs: ## Verify bilingual root documentation and repository links.
	node scripts/verify-docs.mjs scripts/verify-docs.config.json

.PHONY: test-layout
test-layout: bootstrap ## Verify source ownership, licensing boundaries, and the Server pin.
	node --test scripts/verify-workspace.test.mjs
	node scripts/verify-workspace.mjs

.PHONY: test-web
test-web: web-install ## Run Web lint and tests.
	node --test web/tests/*.test.mjs
	cd web && npm run lint
	cd web && npm run typecheck
	cd web && npm test

.PHONY: test-server
test-server: bootstrap ## Run Server tests.
	$(MAKE) -C server test

.PHONY: test-skills
test-skills: ## Run Skills checks without accessing a live ApiMind instance.
	sh skills/scripts/verify.sh

.PHONY: verify
verify: config test-docs test-layout test-web test-server test-skills ## Run workspace and component verification.

.PHONY: reset-integration
reset-integration: ## Explicitly stop the stack and delete local MongoDB data.
	$(COMPOSE_DEV) down -v --remove-orphans
