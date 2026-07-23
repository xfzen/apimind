# ApiMind Modifications

ApiMind Web preserves the Apache-2.0 YApi Web lineage while being maintained as an independent frontend. The main ApiMind changes represented by the current tree are:

- separated the browser frontend from the historical YApi Node server;
- connected Web behavior to ApiMind's Go-side YApi-compatible services;
- modernized the frontend runtime and build around React 18 and Vite;
- added ApiMind workspace, project, API documentation, Markdown editing, and related product flows;
- moved generated production output from tracked `static/prd/` files to ignored `dist/` output;
- restricted production API configuration to `YAPI_API_BASE` and development proxy configuration to `YAPI_API_TARGET`;
- added an Nginx-only container that packages a prebuilt `dist/` and performs no compilation in Docker;
- added standalone repository-boundary, migration, build-output, and container configuration checks.

Detailed implementation history remains available in Git. Selected design and implementation documents that moved with this component are retained under `docs/history/` with their original parent-repository paths recorded in the file headers.
