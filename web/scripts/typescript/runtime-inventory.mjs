import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const modulePath = fileURLToPath(import.meta.url);
const defaultWebRoot = fileURLToPath(new URL('../../', import.meta.url));
const defaultAllowlistPath = fileURLToPath(
  new URL('./runtime-js-allowlist.json', import.meta.url)
);
const allowedRoots = new Set(['client', 'common', 'exts']);
const authenticationPilotPaths = new Set([
  'client/containers/Login/Login.js',
  'client/containers/Login/LoginContainer.js',
  'client/containers/Login/LoginWrap.js',
  'client/containers/Login/Reg.js',
  'client/reducer/modules/user.js'
]);

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(entry => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(path) : [path];
    })
  );
  return files.flat();
}

function normalizeRepositoryPath(path) {
  return path.split(sep).join('/');
}

function sourcePathFromMap(mapPath, sourceRoot, source) {
  if (typeof source !== 'string' || source.length === 0 || source.includes('\0')) {
    return null;
  }

  if (source.startsWith('file://')) {
    return fileURLToPath(source);
  }

  if (/^[a-z][a-z+.-]*:\/\//i.test(source)) {
    return null;
  }

  const rootedSource = sourceRoot ? join(sourceRoot, source) : source;
  return isAbsolute(rootedSource)
    ? rootedSource
    : resolve(dirname(mapPath), rootedSource);
}

export async function collectRuntimeSources(outDir, webRoot) {
  const lexicalOutDir = resolve(outDir);
  const realWebRoot = await realpath(webRoot);
  const mapFiles = (await walkFiles(lexicalOutDir)).filter(path => path.endsWith('.map'));
  const sources = new Set();

  for (const mapPath of mapFiles) {
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    for (const source of map.sources || []) {
      const candidate = sourcePathFromMap(mapPath, map.sourceRoot, source);
      if (!candidate) {
        continue;
      }

      let resolvedSource;
      try {
        resolvedSource = await realpath(candidate);
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }

      const repositoryPath = relative(realWebRoot, resolvedSource);
      if (
        repositoryPath === '' ||
        isAbsolute(repositoryPath) ||
        repositoryPath === '..' ||
        repositoryPath.startsWith(`..${sep}`)
      ) {
        continue;
      }

      const normalizedPath = normalizeRepositoryPath(repositoryPath);
      if (allowedRoots.has(normalizedPath.split('/')[0])) {
        sources.add(normalizedPath);
      }
    }
  }

  return [...sources].sort();
}

export function validateRuntimeJavaScript(sources, allowlist) {
  const allowed = new Set(allowlist.entries.map(entry => entry.path));
  const runtimeJavaScript = sources.filter(path => path.endsWith('.js'));
  return {
    violations: runtimeJavaScript.filter(path => !allowed.has(path)).sort(),
    staleEntries: allowlist.entries
      .map(entry => entry.path)
      .filter(path => !runtimeJavaScript.includes(path))
      .sort()
  };
}

export function prepareRuntimeBuildInputs(webRoot) {
  const generator = resolve(webRoot, 'scripts/generate-plugin-module.js');

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [generator], {
      cwd: webRoot,
      stdio: 'inherit'
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          signal
            ? `Plugin module generator terminated by ${signal}`
            : `Plugin module generator exited with code ${code}`
        )
      );
    });
  });
}

function allowanceFor(path) {
  if (path === 'client/plugin-module.js') {
    return {
      path,
      classification: 'generated',
      reason: 'Generated from the reviewed built-in plugin registry for Vite static analysis',
      exitCondition: 'Replace the generated registry only with an equivalent typed build contract'
    };
  }

  if (path.startsWith('exts/')) {
    return {
      path,
      classification: 'extension-compat',
      reason: 'Existing production extension dependency excluded from this migration',
      exitCondition: 'Replace with a separately approved built-in Web module'
    };
  }

  if (authenticationPilotPaths.has(path)) {
    return {
      path,
      classification: 'migration-target',
      reason: 'Authentication pilot runtime module',
      exitCondition: 'Phase 0 authentication pilot'
    };
  }

  return {
    path,
    classification: 'migration-target',
    reason: 'Existing production JavaScript module awaiting TypeScript migration',
    exitCondition: 'Phase 1-3 plan produced after the authentication pilot'
  };
}

async function loadAllowlist(path) {
  const allowlist = JSON.parse(await readFile(path, 'utf8'));
  if (!allowlist || !Array.isArray(allowlist.entries)) {
    throw new Error(`Invalid runtime JavaScript allowlist: ${path}`);
  }
  return allowlist;
}

async function runCli(args) {
  const modes = ['--check', '--write-baseline', '--json'].filter(mode => args.includes(mode));
  if (!args.includes('--build') || modes.length !== 1) {
    throw new Error('Usage: runtime-inventory.mjs --build (--check|--write-baseline|--json)');
  }

  const webRoot = defaultWebRoot;
  const outDir = await mkdtemp(join(tmpdir(), 'apimind-runtime-inventory-'));

  try {
    await prepareRuntimeBuildInputs(webRoot);
    await build({
      root: webRoot,
      configFile: resolve(webRoot, 'vite.config.mjs'),
      logLevel: 'silent',
      build: {
        outDir,
        emptyOutDir: true,
        sourcemap: true
      }
    });

    const sources = await collectRuntimeSources(outDir, webRoot);
    const runtimeJavaScript = sources.filter(path => path.endsWith('.js'));

    if (modes[0] === '--write-baseline') {
      const allowlist = {
        version: 1,
        entries: runtimeJavaScript.map(allowanceFor)
      };
      await writeFile(defaultAllowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);
      return;
    }

    const allowlist = await loadAllowlist(defaultAllowlistPath);
    const validation = validateRuntimeJavaScript(sources, allowlist);

    if (modes[0] === '--json') {
      process.stdout.write(`${JSON.stringify({ sources, validation }, null, 2)}\n`);
      return;
    }

    if (validation.violations.length || validation.staleEntries.length) {
      process.stderr.write(`${JSON.stringify(validation, null, 2)}\n`);
      process.exitCode = 1;
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
