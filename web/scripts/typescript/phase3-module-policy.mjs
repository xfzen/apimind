import { execFileSync } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const modulePath = fileURLToPath(import.meta.url);
const mapPath = fileURLToPath(
  new URL('./phase3-module-map.json', import.meta.url)
);
const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx'];
const expectedWaveCounts = [13, 20, 22, 27, 6];

export const phaseThreeExcludedPaths = [
  'client/builtins/pluginRegistry.js',
  'client/components/Docs/DocToc.js',
  'client/components/Docs/DocTree.js',
  'client/components/Docs/MarkdownOutline.js',
  'client/components/Docs/MilkdownEditor.js',
  'client/components/MockDoc/MockDoc.js',
  'client/containers/DevTools/DevTools.js',
  'client/containers/Group/ProjectList/UpDateModal.js',
  'client/containers/News/News.js',
  'client/containers/News/NewsList/NewsList.js',
  'client/containers/News/NewsTimeline/NewsTimeline.js',
  'common/config.js',
  'common/createContext.js',
  'common/formats.js',
  'common/lib.js',
  'common/markdown.js',
  'common/mergeJsonSchema.js',
  'common/plugin.js'
];

function normalizePath(path) {
  return path.split(sep).join('/');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function uniqueDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function mapIndexes(map) {
  return {
    bySource: new Map(map.entries.map(entry => [entry.source, entry])),
    byTarget: new Map(map.entries.map(entry => [entry.target, entry]))
  };
}

function repositoryBase(importer, specifier) {
  if (specifier.startsWith('.')) {
    return normalizePath(resolve(dirname(importer), specifier));
  }
  if (/^(?:client|common|exts)(?:\/|$)/.test(specifier)) {
    return specifier;
  }
  return null;
}

function repositoryRelative(webRoot, absolutePath) {
  const path = normalizePath(relative(webRoot, absolutePath));
  if (path === '' || path === '..' || path.startsWith('../')) return null;
  return path;
}

async function resolveRepositoryImport(webRoot, importerPath, specifier, map) {
  const importer = resolve(webRoot, importerPath);
  const base = repositoryBase(importer, specifier);
  if (!base) return null;

  const relativeBase = base.startsWith('/')
    ? repositoryRelative(webRoot, base)
    : normalizePath(base);
  if (!relativeBase) return null;

  const { bySource } = mapIndexes(map);
  const mappedEntry = bySource.get(relativeBase);
  if (mappedEntry) {
    if (await exists(resolve(webRoot, mappedEntry.source))) {
      return {
        resolvedPath: mappedEntry.source,
        legacySource: mappedEntry.source
      };
    }
    if (await exists(resolve(webRoot, mappedEntry.target))) {
      return {
        resolvedPath: mappedEntry.target,
        legacySource: mappedEntry.source
      };
    }
    return {
      resolvedPath: mappedEntry.source,
      legacySource: mappedEntry.source
    };
  }

  const extension = extname(relativeBase);
  const candidates = extension
    ? [relativeBase]
    : [
        relativeBase,
        ...sourceExtensions.map(suffix => `${relativeBase}${suffix}`),
        ...sourceExtensions.map(suffix => `${relativeBase}/index${suffix}`)
      ];

  for (const candidate of candidates) {
    const candidateEntry = bySource.get(candidate);
    if (candidateEntry) {
      if (await exists(resolve(webRoot, candidateEntry.source))) {
        return {
          resolvedPath: candidateEntry.source,
          legacySource: candidateEntry.source
        };
      }
      if (await exists(resolve(webRoot, candidateEntry.target))) {
        return {
          resolvedPath: candidateEntry.target,
          legacySource: candidateEntry.source
        };
      }
      return {
        resolvedPath: candidateEntry.source,
        legacySource: candidateEntry.source
      };
    }
    if (await isFile(resolve(webRoot, candidate))) {
      return { resolvedPath: candidate, legacySource: null };
    }
  }
  return null;
}

async function importsForModule(webRoot, modulePath, map) {
  const source = await readFile(resolve(webRoot, modulePath), 'utf8');
  const info = ts.preProcessFile(source, true, true);
  const importedFiles = [
    ...info.importedFiles,
    ...info.referencedFiles,
    ...info.typeReferenceDirectives,
    ...info.libReferenceDirectives
  ];
  const imports = [];

  for (const importedFile of importedFiles) {
    const specifier = importedFile.fileName;
    const resolvedImport = await resolveRepositoryImport(
      webRoot,
      modulePath,
      specifier,
      map
    );
    if (resolvedImport) imports.push({ specifier, ...resolvedImport });
  }

  return imports;
}

export async function loadPhaseThreeModuleMap(webRoot) {
  const requestedPath = webRoot
    ? resolve(webRoot, 'scripts/typescript/phase3-module-map.json')
    : mapPath;
  const map = JSON.parse(await readFile(requestedPath, 'utf8'));
  if (!map || !Array.isArray(map.entries)) {
    throw new Error(`Invalid Phase 3 module map: ${requestedPath}`);
  }
  return map;
}

export async function collectProductionClosure(webRoot, map) {
  const queue = [map.entry];
  const modules = new Set();
  const imports = [];

  while (queue.length) {
    const modulePath = queue.shift();
    if (modules.has(modulePath)) continue;
    if (!(await exists(resolve(webRoot, modulePath)))) continue;

    modules.add(modulePath);
    for (const imported of await importsForModule(webRoot, modulePath, map)) {
      imports.push({ importer: modulePath, ...imported });
      if (!modules.has(imported.resolvedPath)) queue.push(imported.resolvedPath);
    }
  }

  return {
    modules: [...modules].sort(),
    imports: imports.sort((left, right) =>
      `${left.importer}:${left.specifier}`.localeCompare(
        `${right.importer}:${right.specifier}`
      )
    )
  };
}

async function compareExcludedPaths(webRoot, baseline) {
  const changes = [];
  for (const path of phaseThreeExcludedPaths) {
    try {
      const baselineBytes = execFileSync(
        'git',
        ['-C', webRoot, 'show', `${baseline}:web/${path}`],
        { encoding: null, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      const currentBytes = await readFile(resolve(webRoot, path));
      if (!baselineBytes.equals(currentBytes)) changes.push(path);
    } catch {
      changes.push(path);
    }
  }
  return changes;
}

function unsafeMatches(path, source) {
  const patterns = [
    ['any', /\bany\b/g],
    ['@ts-ignore', /@ts-ignore/g],
    ['@ts-nocheck', /@ts-nocheck/g]
  ];
  const matches = [];
  for (const [kind, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      matches.push({ path, kind, index: match.index });
    }
  }
  return matches;
}

export async function scanCompletedTargets(webRoot, map, completedWave) {
  const completedEntries = map.entries.filter(
    entry => entry.wave <= completedWave
  );
  const completedSources = new Set(completedEntries.map(entry => entry.source));
  const unsafeEscapeMatches = [];

  for (const entry of completedEntries) {
    try {
      const source = await readFile(resolve(webRoot, entry.target), 'utf8');
      unsafeEscapeMatches.push(...unsafeMatches(entry.target, source));
    } catch {
      // Source/target state is asserted by the caller with a path-specific message.
    }
  }

  const closure = await collectProductionClosure(webRoot, map);
  const legacyCompletedSourceSpecifiers = closure.imports
    .filter(item => {
      if (item.importer.startsWith('exts/')) return false;
      if (phaseThreeExcludedPaths.includes(item.importer)) {
        return false;
      }
      return (
        item.specifier.endsWith('.js') &&
        completedSources.has(item.legacySource)
      );
    })
    .map(item => ({
      importer: item.importer,
      specifier: item.specifier,
      source: item.legacySource
    }));

  return {
    unsafeEscapeMatches,
    legacyCompletedSourceSpecifiers,
    excludedSourceChanges: await compareExcludedPaths(webRoot, map.baseline)
  };
}

export async function validatePhaseThreeModuleMap(webRoot, map) {
  const { bySource, byTarget } = mapIndexes(map);
  const closure = await collectProductionClosure(webRoot, map);
  const completedWave = Number(process.env.PHASE3_COMPLETED_WAVE || 0);
  const completedValidation = await scanCompletedTargets(
    webRoot,
    map,
    completedWave
  );
  const invalidExtensions = map.entries
    .filter(entry => {
      if (!entry.source.endsWith('.js')) return true;
      if (!/\.tsx?$/.test(entry.target)) return true;
      return entry.source.slice(0, -3) !== entry.target.replace(/\.tsx?$/, '');
    })
    .map(entry => ({ source: entry.source, target: entry.target }));
  const actualWaveCounts = expectedWaveCounts.map((_, index) =>
    map.entries.filter(entry => entry.wave === index + 1).length
  );
  const invalidWaveCounts = actualWaveCounts.flatMap((count, index) =>
    count === expectedWaveCounts[index]
      ? []
      : [{ wave: index + 1, expected: expectedWaveCounts[index], actual: count }]
  );
  const forwardWaveEdges = closure.imports.flatMap(item => {
    const importer = bySource.get(item.importer) || byTarget.get(item.importer);
    const imported = bySource.get(item.resolvedPath) || byTarget.get(item.resolvedPath);
    return importer && imported && imported.wave > importer.wave
      ? [{ from: item.importer, to: item.resolvedPath }]
      : [];
  });
  const unexpectedExcludedReachability = closure.modules.filter(path =>
    phaseThreeExcludedPaths.includes(path)
  );
  const unmappedReachableJavaScript = closure.modules.filter(path => {
    if (!path.endsWith('.js')) return false;
    if (path === 'client/plugin-module.js' || path.startsWith('exts/')) return false;
    if (bySource.has(path) || byTarget.has(path)) return false;
    if (phaseThreeExcludedPaths.includes(path)) return false;
    return true;
  });

  return {
    duplicateSources: uniqueDuplicates(map.entries.map(entry => entry.source)),
    duplicateTargets: uniqueDuplicates(map.entries.map(entry => entry.target)),
    invalidExtensions,
    invalidWaveCounts,
    forwardWaveEdges,
    unmappedReachableJavaScript,
    unexpectedExcludedReachability,
    ...completedValidation
  };
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const webRoot = resolve(dirname(modulePath), '../..');
  const map = await loadPhaseThreeModuleMap(webRoot);
  process.stdout.write(
    `${JSON.stringify(await validatePhaseThreeModuleMap(webRoot, map), null, 2)}\n`
  );
}
