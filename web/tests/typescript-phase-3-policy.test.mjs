import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  loadPhaseThreeModuleMap,
  phaseThreeExcludedPaths,
  scanCompletedTargets,
  validatePhaseThreeModuleMap
} from '../scripts/typescript/phase3-module-policy.mjs';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function countByWave(entries) {
  return [1, 2, 3, 4, 5].map(
    wave => entries.filter(entry => entry.wave === wave).length
  );
}

const retiredDormantJavaScript = [
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
  'common/mergeJsonSchema.js',
  'common/plugin.js'
];

test('dormant JavaScript stays retired while live compatibility dependencies remain explicit', async () => {
  assert.deepEqual(phaseThreeExcludedPaths, [
    'client/builtins/pluginRegistry.js',
    'common/lib.js',
    'common/markdown.js'
  ]);

  for (const path of retiredDormantJavaScript) {
    assert.equal(await exists(resolve(webRoot, path)), false, `${path} must stay retired`);
  }
});

test('Phase 3 map defines a dependency-closed 88-module migration', async () => {
  const map = await loadPhaseThreeModuleMap(webRoot);
  const validation = await validatePhaseThreeModuleMap(webRoot, map);

  assert.equal(map.version, 1);
  assert.equal(map.baseline, 'fd06247');
  assert.equal(map.entry, 'client/index.jsx');
  assert.equal(map.entries.length, 88);
  assert.deepEqual(countByWave(map.entries), [13, 20, 22, 27, 6]);
  assert.deepEqual(validation.duplicateSources, []);
  assert.deepEqual(validation.duplicateTargets, []);
  assert.deepEqual(validation.invalidExtensions, []);
  assert.deepEqual(validation.invalidWaveCounts, []);
  assert.deepEqual(validation.forwardWaveEdges, []);
  assert.deepEqual(validation.unmappedReachableJavaScript, []);
  assert.deepEqual(validation.unexpectedExcludedReachability, []);
});

test('Phase 3 completed waves contain only typed targets and safe consumers', async () => {
  const completedWave = Number(process.env.PHASE3_COMPLETED_WAVE || 5);
  assert.ok(
    Number.isInteger(completedWave) && completedWave >= 0 && completedWave <= 5,
    'PHASE3_COMPLETED_WAVE must be an integer from 0 through 5'
  );

  const map = await loadPhaseThreeModuleMap(webRoot);
  for (const entry of map.entries) {
    const migrated = entry.wave <= completedWave;
    assert.equal(
      await exists(resolve(webRoot, entry.source)),
      !migrated,
      `${entry.source} migration state must match completed wave ${completedWave}`
    );
    assert.equal(
      await exists(resolve(webRoot, entry.target)),
      migrated,
      `${entry.target} migration state must match completed wave ${completedWave}`
    );
  }

  const completedValidation = await scanCompletedTargets(
    webRoot,
    map,
    completedWave
  );
  assert.deepEqual(completedValidation.unsafeEscapeMatches, []);
  assert.deepEqual(completedValidation.legacyCompletedSourceSpecifiers, []);
  assert.deepEqual(completedValidation.excludedSourceChanges, []);
});
