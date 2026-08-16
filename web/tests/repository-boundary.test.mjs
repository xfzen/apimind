import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../", import.meta.url).pathname);

test("repository boundary checker rejects cross-component and direct API dependencies", () => {
  const checker = resolve(root, "scripts/check-repository-boundary.mjs");
  assert.equal(existsSync(checker), true, "repository boundary checker is required");
  const source = readFileSync(checker, "utf8");
  assert.match(source, /"playwright\.config\.ts"/);
  assert.match(source, /"scripts\/smoke\/typescript-pilot-live\.sh"/);
  assert.doesNotThrow(() => execFileSync("node", [checker], { cwd: root, stdio: "pipe" }));
});

test("package metadata describes an independent browser application", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  assert.equal(pkg.name, "@apimind/web");
  assert.equal(pkg.version, "0.1.0");
  assert.equal(lock.version, "0.1.0");
  assert.equal(lock.packages[""].version, "0.1.0");
  assert.equal(pkg.private, true);
  assert.equal("main" in pkg, false);
  assert.equal("npm-publish" in pkg.scripts, false);
  assert.equal(pkg.repository.url, "https://github.com/xfzen/apimind.git");
  assert.equal(pkg.repository.directory, "web");
  assert.equal(existsSync(resolve(root, "npm-publish.js")), false);
});

test("npm cache configuration is repository-relative", () => {
  const npmrc = readFileSync(resolve(root, ".npmrc"), "utf8");
  assert.doesNotMatch(npmrc, /\/Users\//);
  assert.match(npmrc, /^cache=\.npm-cache$/m);
});

test("legacy browser integrations and unused editor distribution are absent", () => {
  for (const relative of [
    "client/components/Postman/CheckCrossInstall.js",
    "client/components/Notify/Notify.js",
    "static/attachment/cross-request.zip",
    "common/tui-editor"
  ]) {
    assert.equal(existsSync(resolve(root, relative)), false, `${relative} must be removed`);
  }
});
