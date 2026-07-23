# ApiMind Skills Documentation

[中文](README.md)

## Skill Entrypoints

- [`apimind-project-config`](../skills/apimind-project-config/SKILL.md): project mapping and repository instruction configuration;
- [`apimind-contract`](../skills/apimind-contract/SKILL.md): contract reads and confirmation-gated maintenance after explicit requests.

## Compatibility and Configuration

- [Server compatibility metadata](../compatibility/server.yaml): `apimind-mcp-v1` and `yapi-http-v1`;
- [Project mapping example](../examples/apimind-contract.yaml);
- [Compatibility checker](../scripts/check-compatibility.mjs).

## Maintainer Documentation

- [ApiMind Contract Skill maintenance prompt](apimind-contract-skill-maintenance-prompt.md): maintainer-only guidance for updating and reviewing Skill behavior, not an end-user Quick Start;
- [Contributing guide](../CONTRIBUTING.md);
- [Migration record](../MIGRATION.md).

## Verification, Security, and License

- [Package checker](../scripts/package-check.mjs);
- [Complete verification entrypoint](../scripts/verify.sh);
- [Security policy](../SECURITY.md);
- [Apache-2.0](../LICENSE).
