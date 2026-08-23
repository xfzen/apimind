# Connector SDK delivery status

The source module is `github.com/xfzen/ecp/sdk/go`. ECP remains in the ApiMind monorepo for the current delivery phase, so the SDK is consumed through the repository root `go.work` and is not separately tagged, published, or submitted.

Local contract and import verification are implemented by `scripts/verify-release.sh`. ApiMind records `github.com/xfzen/ecp/sdk/go v0.0.0` as a workspace dependency and must not use a local `replace`. The stable module and `connector/v1` import paths preserve a future extraction path without making extraction a G0 requirement.

Current evidence:

- Delivery mode: monorepo workspace
- Separate repository submission: deliberately deferred
- Tag and module checksum: not applicable until extraction is approved
- Official proxy verification: mandatory before a future repository split

Before removing the ECP entries from the root `go.work`, publish `sdk/go/v0.1.0` (or the then-approved first release) from the canonical repository, verify it from a clean module with `GOWORK=off` through the official Go proxy, record its source commit and checksum, and replace ApiMind's `v0.0.0` requirement with that released version.
