#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
let root = resolve(new URL("../", import.meta.url).pathname);
let allowUninitializedServer = false;

while (args.length > 0) {
  const argument = args.shift();
  if (argument === "--root") {
    const value = args.shift();
    if (!value) {
      process.stderr.write("usage: verify-workspace.mjs [--root PATH] [--allow-uninitialized-server]\n");
      process.exit(2);
    }
    root = resolve(value);
  } else if (argument === "--allow-uninitialized-server") {
    allowUninitializedServer = true;
  } else {
    process.stderr.write(`unknown argument: ${argument}\n`);
    process.exit(2);
  }
}

const failures = [];

const required = [
  "LICENSE",
  "LICENSING.md",
  "COMPONENTS.md",
  "COMPATIBILITY.md",
  "compatibility.yaml",
  "web/LICENSE",
  "web/package.json",
  "skills/LICENSE",
  "skills/.codex-plugin/plugin.json",
];
if (!allowUninitializedServer) required.push("server/LICENSE", "server/LICENSING.md");
for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`missing required path: ${path}`);
}

for (const path of ["app", "web/.git", "skills/.git"]) {
  if (existsSync(resolve(root, path))) failures.push(`forbidden repository path: ${path}`);
}

const modules = readFileSync(resolve(root, ".gitmodules"), "utf8");
if (!modules.includes('submodule "server"')) failures.push("server submodule declaration is missing");
if (!modules.includes("https://github.com/xfzen/apimind-server.git")) failures.push("server submodule URL is invalid");
if (!modules.includes("shallow = true")) failures.push("server submodule must default to a shallow checkout");
if (/submodule "(?:web|skills|app)"/.test(modules)) failures.push("only Server may be a submodule");

const serverStage = execFileSync("git", ["ls-files", "--stage", "server"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const serverMatch = serverStage.match(/^160000 ([0-9a-f]{40}) 0\tserver$/);
if (!serverMatch) failures.push("server must be committed as a Git submodule");

const compatibility = readFileSync(resolve(root, "compatibility.yaml"), "utf8");
const manifestCommit = compatibility.match(/^    commit: ([0-9a-f]{40})$/m)?.[1];
if (serverMatch && manifestCommit !== serverMatch[1]) {
  failures.push("compatibility.yaml Server commit differs from the gitlink");
}

const web = JSON.parse(readFileSync(resolve(root, "web/package.json"), "utf8"));
if (web.repository?.url !== "https://github.com/xfzen/apimind.git") failures.push("Web repository URL is invalid");
if (web.repository?.directory !== "web") failures.push("Web repository directory is invalid");

const skills = JSON.parse(readFileSync(resolve(root, "skills/.codex-plugin/plugin.json"), "utf8"));
for (const value of [skills.homepage, skills.repository, skills.interface?.websiteURL]) {
  if (value !== "https://github.com/xfzen/apimind") failures.push("Skills repository metadata is invalid");
}

const licensing = readFileSync(resolve(root, "LICENSING.md"), "utf8");
if (!licensing.includes("does **not** apply") || !licensing.includes("server/")) {
  failures.push("LICENSING.md does not exclude the Server submodule from the root license");
}

const compose = readFileSync(resolve(root, "deploy/docker-compose.yml"), "utf8");
if (!/^name: apimind-public$/m.test(compose)) {
  failures.push("Compose project must isolate public-workspace data as apimind-public");
}

if (existsSync(resolve(root, "server")) && !lstatSync(resolve(root, "server")).isDirectory()) {
  failures.push("server submodule path is not a directory");
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`WORKSPACE: ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`workspace layout verified: server=${serverMatch[1]}\n`);
