# Detailed YApi Changes Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not use subagents.

**Goal:** Add a detailed Chinese guide explaining the current ApiMind Web changes from its YApi Web baseline, then expose it from the Chinese README and documentation index.

**Architecture:** Keep the root README as the concise comparison surface and keep `MODIFICATIONS.md` as the licensing-oriented English summary. Put expanded, current-snapshot evidence in `docs/changes-from-yapi.md`, and include that file in the public documentation verifier.

**Tech Stack:** Markdown, Node.js documentation verifier, Node.js test runner, Git.

## Global Constraints

- Do not scan Git history.
- Do not use subagents.
- Describe only behavior supported by the current Web source, configuration, or tests.
- Do not document PC App behavior, Server internals, or PostgreSQL roadmap items as current Web capabilities.
- Keep `MODIFICATIONS.md` and the English README unchanged.
- Do not compile Web inside Docker.

---

### Task 1: Add the detailed changes guide

**Files:**
- Create: `docs/changes-from-yapi.md`
- Modify: `scripts/verify-docs.config.json`
- Test: `scripts/verify-docs.mjs`

**Interfaces:**
- Consumes: Current Web files under `client/`, `common/`, `exts/`, `scripts/`, `tests/`, plus `vite.config.mjs`, `package.json`, and `Dockerfile`.
- Produces: A link-checkable public document at `docs/changes-from-yapi.md`.

- [ ] **Step 1: Add the expected document to the verifier before creating it**

Add `docs/changes-from-yapi.md` to both `linkFiles` and `surfaceFiles` in `scripts/verify-docs.config.json`.

- [ ] **Step 2: Run the verifier and confirm the missing document fails**

Run:

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
```

Expected: non-zero exit with `missing required public documentation file: docs/changes-from-yapi.md` or an equivalent missing-file error.

- [ ] **Step 3: Write the detailed guide**

Create `docs/changes-from-yapi.md` with:

- scope and authority rules;
- a concise current-state summary table;
- expanded sections for application architecture, frontend stack, documentation experience, project reuse, import/export and plugins, security, build/deployment, and engineering quality;
- one vertical table per dimension with rows for YApi baseline, ApiMind change, practical impact, compatibility note, and current-tree evidence;
- table-based scope, retained YApi-compatible workflows, explicit exclusions, and related documents;
- links to `README.md`, `MODIFICATIONS.md`, `MIGRATION.md`, `HISTORICAL_CODE.md`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 4: Run public documentation verification**

Run:

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
```

Expected: `public documentation verification passed`.

- [ ] **Step 5: Commit the guide and its verification coverage**

```bash
git add docs/changes-from-yapi.md scripts/verify-docs.config.json
git commit -m "docs: add detailed YApi changes guide"
```

### Task 2: Add navigation to the detailed guide

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Test: `scripts/verify-docs.mjs`
- Test: `tests/container-config.test.mjs`
- Test: `tests/repository-boundary.test.mjs`

**Interfaces:**
- Consumes: `docs/changes-from-yapi.md` from Task 1.
- Produces: Discoverable links from the Chinese project overview and documentation index.

- [ ] **Step 1: Link the guide from the root README**

In the paragraph after the comparison table, add `docs/changes-from-yapi.md` as the first detailed reading link while preserving the existing links to `MODIFICATIONS.md`, `MIGRATION.md`, and `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 2: Link the guide from the documentation index**

Add `详细修改与改进` pointing to `changes-from-yapi.md` under `## 当前开发与验证` in `docs/README.md`.

- [ ] **Step 3: Run the full relevant verification**

Run:

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
node --test tests/container-config.test.mjs tests/repository-boundary.test.mjs
git diff --check
```

Expected:

- public documentation verification passes;
- 7 tests pass with 0 failures;
- `git diff --check` exits successfully with no output.

- [ ] **Step 4: Commit navigation updates**

```bash
git add README.md docs/README.md
git commit -m "docs: link detailed changes guide"
```
