# Historical Code Boundary

This repository was created from the YApi source repository at commit `e6b9c575ceac31fb91d352a926c25eb30f66684b` and preserves that repository's Git ancestry. The migration is documented in [`MIGRATION.md`](MIGRATION.md).

The current tree is frontend-only. The historical YApi Node server was removed from the source tree before this repository split (removal commit `89f2666e33b8476da38cd61e9b81b79492866568`). Older server blobs remain reachable through preserved Git history solely as historical source; they are not built, packaged, supported, or part of the current runtime.

Current browser code must communicate with ApiMind Go-side services and must not restore direct dependencies on the historical Node server or neighboring repositories. Historical files remain governed by the copyright and license notices that applied to them; the repository split does not erase attribution or relicense third-party material.
