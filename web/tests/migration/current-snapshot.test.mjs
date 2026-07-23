import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../../", import.meta.url).pathname);
const sourceCommit = "e6b9c575ceac31fb91d352a926c25eb30f66684b";

test("current Web snapshot excludes Node backend entry paths", () => {
  for (const path of ["server/app.js", "server/controllers", "server/models"]) {
    assert.equal(existsSync(resolve(root, path)), false, `${path} must be absent`);
  }

  for (const path of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"]) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} is required`);
  }
});

test("migration record identifies the source and current-file publication boundary", () => {
  const migrationPath = resolve(root, "MIGRATION.md");
  assert.equal(existsSync(migrationPath), true, "MIGRATION.md is required");
  const migration = readFileSync(migrationPath, "utf8");
  for (const required of [
    "https://github.com/YMFE/yapi",
    sourceCommit,
    "current-file snapshot",
    "private history is not published",
  ]) {
    assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
