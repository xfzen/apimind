import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../", import.meta.url).pathname);
const workspace = resolve(root, "..");

test("unified CI pins actions, verifies Web, and never publishes", () => {
  const workflow = readFileSync(resolve(workspace, ".github/workflows/verify.yml"), "utf8");
  assert.match(workflow, /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/);
  assert.match(workflow, /actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38/);
  assert.match(workflow, /branches:\s*\[dev\]/);
  assert.doesNotMatch(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /make test-web/);
  assert.match(workflow, /node --test scripts\/verify-workspace\.test\.mjs/);
  assert.match(
    workflow,
    /node scripts\/verify-workspace\.mjs --allow-uninitialized-server/,
  );
  assert.match(workflow, /if: github\.event\.repository\.private == false/);
  assert.doesNotMatch(workflow, /uses:\s*\S+@(main|master|v\d+)(?:\s|$)/m);
  assert.doesNotMatch(workflow, /(?:docker\s+(?:login|push)|npm\s+publish|image:\s*\S*:latest|trivy-action|setup-trivy)/i);
  assert.match(workflow, /gitleaks_8\.30\.1_linux_x64\.tar\.gz/);
});

test("commit policy accepts CI-only repository changes", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.ok(pkg.config["validate-commit-msg"].types.includes("ci"));
});

test("secret scan reads only the current tracked snapshot", () => {
  const verify = readFileSync(resolve(root, "scripts/verify.sh"), "utf8");
  assert.match(verify, /git archive HEAD/);
  assert.doesNotMatch(verify, /gitleaks[^\n]*\sdir\s+\.\s/);
  assert.doesNotMatch(verify, /gitleaks[^\n]*\sgit\s/);
});
