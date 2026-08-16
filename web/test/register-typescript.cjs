const path = require('node:path');
const phaseThreeMap = require('../scripts/typescript/phase3-module-map.json');
const { registerTypeScriptLoader } = require('./typescript-loader.cjs');

const webRoot = path.resolve(__dirname, '..');
const migratedModulePaths = new Map(
  [
    'client/common.js',
    'client/constants/variable.js',
    'client/utils/backend.js',
    'client/utils/request.js',
    'common/HandleImportData.js',
    'common/diff-view.js',
    'common/mock-extra.js',
    'common/postmanLib.js',
    'common/power-string.js',
    'common/sanitize.js',
    'common/schema-transformTo-table.js',
    'common/utils.js',
    'common/validators.js',
    'client/reducer/create.js',
    'client/reducer/middleware/messageMiddleware.js',
    'client/reducer/modules/addInterface.js',
    'client/reducer/modules/docs.js',
    'client/reducer/modules/follow.js',
    'client/reducer/modules/group.js',
    'client/reducer/modules/interface.js',
    'client/reducer/modules/interfaceCol.js',
    'client/reducer/modules/menu.js',
    'client/reducer/modules/mockCol.js',
    'client/reducer/modules/news.js',
    'client/reducer/modules/project.js',
    'client/reducer/modules/reducer.js',
    'client/reducer/modules/template.js'
  ].map(relativePath => [
    path.resolve(webRoot, relativePath),
    path.resolve(webRoot, relativePath.replace(/\.js$/, '.ts'))
  ])
);

for (const entry of phaseThreeMap.entries) {
  migratedModulePaths.set(
    path.resolve(webRoot, entry.source),
    path.resolve(webRoot, entry.target)
  );
}

registerTypeScriptLoader(migratedModulePaths);
