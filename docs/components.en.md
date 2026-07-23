# Components

[中文](components.md)

## ApiMind Server

[`server/`](../server/) is a Git submodule pinned to a public commit in the
[xfzen/apimind-server](https://github.com/xfzen/apimind-server) upstream
repository. It is the Headless/API-first Runtime Core for YApi-compatible HTTP,
HTTP Mock, test-collection execution, MCP HTTP, OpenAPI 3.0.3, and MongoDB. Its
[documentation index](https://github.com/xfzen/apimind-server/blob/dev/docs/README.en.md)
is the technical authority.

## ApiMind Web

[`web/`](../web/) is maintained directly in this repository. It provides the
YApi-compatible browser experience and accesses authentication, storage, and
business APIs only through the Go service. Its
[documentation index](../web/docs/README.en.md) is the technical authority.

## ApiMind Skills

[`skills/`](../skills/) is maintained directly in this repository and provides
Codex/MCP project configuration and explicit-confirmation-gated contract
maintenance. Its [documentation index](../skills/docs/README.en.md) is the
technical authority.

See [`COMPATIBILITY.md`](../COMPATIBILITY.md) for the pinned component set and
[`LICENSING.md`](../LICENSING.md) for license boundaries.
