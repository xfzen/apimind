import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("../", import.meta.url).pathname);

test("container packages a prebuilt dist into an Nginx-only runtime", () => {
  const dockerfilePath = resolve(root, "Dockerfile");
  assert.equal(existsSync(dockerfilePath), true, "Dockerfile is required");
  const dockerfile = readFileSync(dockerfilePath, "utf8");
  assert.match(
    dockerfile,
    /^FROM nginxinc\/nginx-unprivileged:alpine-slim@sha256:90d82b3358df5758b3c57d20f2565082ce6f744906e7dc09afd0096c1b8eb2b5 AS runtime$/m
  );
  assert.equal((dockerfile.match(/^FROM /gm) || []).length, 1);
  assert.match(dockerfile, /COPY dist \/usr\/share\/nginx\/html/);
  assert.doesNotMatch(dockerfile, /node|npm|RUN\s+.*build|server\/app\.js/i);

  const dockerignore = readFileSync(resolve(root, ".dockerignore"), "utf8");
  assert.match(dockerignore, /^!dist\/\*\*$/m);
});

test("Nginx serves a single-page application on port 8080", () => {
  const nginx = readFileSync(resolve(root, "deploy/nginx.conf"), "utf8");
  assert.match(nginx, /listen\s+8080/);
  assert.match(nginx, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html/);
});

test("README documents host build before runtime image packaging", () => {
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  assert.match(readme, /YAPI_API_BASE=.*npm run build/);
  assert.match(readme, /docker build -t apimind-web/);
  assert.match(readme, /Docker[^\n]*(?:不编译|does not build)/i);
});

test("container smoke packages existing dist without compiling", () => {
  const smoke = readFileSync(resolve(root, "scripts/smoke/container-smoke.sh"), "utf8");
  assert.match(smoke, /test -f dist\/index\.html/);
  assert.match(smoke, /docker build/);
  assert.match(smoke, /127\.0\.0\.1::8080/);
  assert.match(smoke, /docker exec/);
  assert.doesNotMatch(smoke, /^\s*(?:npm (?:ci|install|run build)|node )/m);
});
