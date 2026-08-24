import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const sourceRoot = resolve(new URL("../", import.meta.url).pathname);
const verifier = resolve(sourceRoot, "scripts/verify-workspace.mjs");
const serverCommit = "efa84e879e5aa85f4c2437d0d83381aac90be6ee";

test("private CI can validate the gitlink without materializing the private Server", () => {
  const fixture = mkdtempSync(join(tmpdir(), "apimind-workspace-"));
  const files = [
    ".gitmodules",
    "COMPATIBILITY.md",
    "COMPONENTS.md",
    "LICENSE",
    "LICENSING.md",
    "compatibility.yaml",
    "deploy/docker-compose.yml",
    "web/LICENSE",
    "web/package.json",
    "skills/LICENSE",
    "skills/.codex-plugin/plugin.json",
    ".agents/plugins/marketplace.json",
  ];

  try {
    for (const file of files) {
      const target = resolve(fixture, file);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(resolve(sourceRoot, file), target);
    }
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync(
      "git",
      ["update-index", "--add", "--cacheinfo", `160000,${serverCommit},server`],
      { cwd: fixture },
    );

    const strict = spawnSync(process.execPath, [verifier, "--root", fixture], {
      encoding: "utf8",
    });
    assert.notEqual(strict.status, 0);
    assert.match(strict.stderr, /missing required path: server\/LICENSE/);

    const privateCi = spawnSync(
      process.execPath,
      [verifier, "--root", fixture, "--allow-uninitialized-server"],
      { encoding: "utf8" },
    );
    assert.equal(privateCi.status, 0, privateCi.stderr);
    assert.match(privateCi.stdout, new RegExp(`server=${serverCommit}`));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
