# Web Repository Migration

ApiMind Web is derived from the [YMFE/YApi](https://github.com/YMFE/yapi) project under Apache License 2.0. The approved source baseline for this migration is `e6b9c575ceac31fb91d352a926c25eb30f66684b`.

This repository is prepared for publication as a `current-file snapshot`. The public snapshot contains the reviewed Web source and required attribution files only; private history is not published. No Git-history, reflog, other-ref, or unreachable-object scan is required or performed by the current publication checks.

The current snapshot excludes the historical Node backend and keeps the browser application independent from the ApiMind Go service. The browser communicates with that service through same-origin requests or the local development proxy.

Apache-2.0 copyright and notice obligations remain in effect. YApi attribution is retained in [`NOTICE`](NOTICE), third-party details are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and ApiMind-specific changes are summarized in [`MODIFICATIONS.md`](MODIFICATIONS.md).

This migration record describes current files and licensing duties. It does not assert a remote state, branch inventory, reachable commit count, or publication status.
