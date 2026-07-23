import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../", import.meta.url).pathname);
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const failures = [];

const sourceExtensions = /\.(?:c?js|mjs|jsx|ts|tsx|json|ya?ml|toml|sh)$/;
const ignoredPrefixes = ["docs/", "test/fixtures/", "tests/", "static/prd/"];
const ignoredFiles = new Set(["scripts/check-repository-boundary.mjs"]);
const crossComponent = /(?:^|[('"`\s])\.\.\/(?:server|apimind|skills|app)(?:\/|[)'"`\s]|$)/m;
const directRemoteApi = /\b(?:fetch|axios\.(?:get|post|put|patch|delete)|request)\s*\(\s*['"`]https?:\/\//m;
const legacyBrowserIntegration =
  /crossRequest|cross-request|download_crx|fastmock\.site|versionNotify|YAPI_VERSION_NOTIFY/;

for (const file of tracked) {
  if (
    !sourceExtensions.test(file) ||
    !existsSync(resolve(root, file)) ||
    ignoredFiles.has(file) ||
    ignoredPrefixes.some((prefix) => file.startsWith(prefix))
  ) continue;
  const content = readFileSync(resolve(root, file), "utf8");
  if (crossComponent.test(content)) failures.push(`${file}: cross-component relative path`);
  if (directRemoteApi.test(content)) failures.push(`${file}: direct remote business API call`);
  if (legacyBrowserIntegration.test(content)) {
    failures.push(`${file}: removed browser integration`);
  }
  if (file !== "vite.config.mjs" && content.includes("YAPI_API_TARGET")) {
    failures.push(`${file}: YAPI_API_TARGET is reserved for the Vite development proxy`);
  }
}

const trackedProduction = tracked.filter((file) => file.startsWith("static/prd/"));
if (trackedProduction.length > 0) failures.push("static/prd contains tracked build output");
if (
  tracked.some(
    (file) => file.startsWith("common/tui-editor/") && existsSync(resolve(root, file))
  )
) {
  failures.push("common/tui-editor contains an unused legacy distribution");
}

const vite = readFileSync(resolve(root, "vite.config.mjs"), "utf8");
if ((vite.match(/YAPI_API_TARGET/g) || []).length !== 1) {
  failures.push("vite.config.mjs must read YAPI_API_TARGET exactly once for the development proxy");
}
if (/YAPI_API_DIRECT|dev\.proxy\.json/.test(vite)) {
  failures.push("development proxy cannot be bypassed by repository-local direct mode");
}

if (failures.length > 0) {
  for (const failure of failures.sort()) process.stderr.write(`BOUNDARY: ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`repository boundary passed: files=${tracked.length}\n`);
