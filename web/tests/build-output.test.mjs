import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../", import.meta.url).pathname);

test("production build output is isolated in ignored dist", () => {
  const trackedProduction = execFileSync("git", ["-C", root, "ls-files", "static/prd/**"], { encoding: "utf8" }).trim();
  assert.equal(trackedProduction, "");

  const ignore = readFileSync(resolve(root, ".gitignore"), "utf8");
  assert.match(ignore, /^\/dist\/$/m);

  const vite = readFileSync(resolve(root, "vite.config.mjs"), "utf8");
  assert.match(vite, /outDir:\s*['"]dist['"]/);
  assert.match(vite, /emptyOutDir:\s*true/);
  assert.doesNotMatch(vite, /input:\s*path\.resolve\(__dirname,\s*['"]client\/index\.jsx['"]\)/);
  assert.doesNotMatch(vite, /YAPI_API_DIRECT|dev\.proxy\.json/);
  assert.equal((vite.match(/YAPI_API_TARGET/g) || []).length, 1);
  assert.ok((vite.match(/YAPI_API_BASE/g) || []).length >= 1);
  assert.match(vite, /['"]process\.platform['"]:\s*JSON\.stringify\(['"]browser['"]\)/);
  assert.doesNotMatch(vite, /import commonjs from ['"]@rollup\/plugin-commonjs['"]/);
  assert.doesNotMatch(vite, /commonjs\(\{/);
  assert.match(vite, /commonjsOptions:\s*\{/);
  assert.match(vite, /requireReturnsDefault:\s*['"]preferred['"]/);
  assert.match(vite, /defaultIsModuleExports:\s*['"]auto['"]/);
  assert.match(vite, /include:\s*\[[^\]]*node_modules[^\]]*common[^\]]*client[^\]]*\]/s);
});

test("an existing production output contains a deployable HTML entry", () => {
  const dist = resolve(root, "dist");
  if (!existsSync(dist)) return;
  assert.equal(existsSync(resolve(dist, "index.html")), true);
});

test("the react-is CommonJS shim uses the explicitly converted default export", () => {
  const shim = readFileSync(resolve(root, "client/shims/react-is.ts"), "utf8");
  assert.match(shim, /^import ReactIs from /m);
  assert.match(shim, /react-is\.production\.min\.js/);
  assert.doesNotMatch(shim, /react-is\.development\.js/);
});
