const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const originalResolveFilename = Module._resolveFilename;
const webRoot = path.resolve(__dirname, '..');
const migratedModulePaths = new Set(
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
  ].map(relativePath => path.resolve(webRoot, relativePath))
);

function resolveRequestedPath(request, parent) {
  if (path.isAbsolute(request)) return path.resolve(request);
  if (request.startsWith('.') && parent?.filename) {
    return path.resolve(path.dirname(parent.filename), request);
  }
  if (request.startsWith('client/') || request.startsWith('common/')) {
    return path.resolve(webRoot, request);
  }
  return null;
}

Module._resolveFilename = function resolveMigratedTypeScript(
  request,
  parent,
  isMain,
  options
) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (error) {
    const requestedPath = resolveRequestedPath(request, parent);
    if (!requestedPath || !migratedModulePaths.has(requestedPath)) {
      throw error;
    }
    const typeScriptRequest = `${requestedPath.slice(0, -3)}.ts`;
    return originalResolveFilename.call(
      this,
      typeScriptRequest,
      parent,
      isMain,
      options
    );
  }
};

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      experimentalDecorators: true,
      useDefineForClassFields: false
    }
  });
  module._compile(result.outputText, filename);
};
