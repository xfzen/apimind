import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../", import.meta.url).pathname);
const workspace = resolve(root, "..");

test("unified CI pins actions, verifies Skills, and never publishes", () => {
  const workflow = readFileSync(resolve(workspace, ".github/workflows/verify.yml"), "utf8");
  assert.match(workflow, /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/);
  assert.match(workflow, /actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38/);
  assert.match(workflow, /branches:\s*\[dev\]/);
  assert.doesNotMatch(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /sh skills\/scripts\/verify\.sh/);
  assert.doesNotMatch(workflow, /uses:\s*\S+@(main|master|v\d+)(?:\s|$)/m);
  assert.doesNotMatch(workflow, /(?:docker\s+(?:login|push)|npm\s+publish|image:\s*\S*:latest|trivy-action|setup-trivy)/i);
});

test("Skills security policy follows the dev default branch", () => {
  const security = readFileSync(resolve(root, "SECURITY.md"), "utf8");
  assert.match(security, /current `dev` branch/);
  assert.doesNotMatch(security, /current `main` branch/);
});
