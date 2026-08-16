const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function compileTypeScript(source, filename) {
  return ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      experimentalDecorators: true,
      useDefineForClassFields: false
    }
  }).outputText;
}

function absoluteRequestPath(request, parent) {
  if (path.isAbsolute(request)) return path.resolve(request);
  if (request.startsWith('.') && parent && parent.filename) {
    return path.resolve(path.dirname(parent.filename), request);
  }
  return null;
}

function createMappedResolver(mapping) {
  const normalizedMapping = new Map(
    [...mapping].map(([source, target]) => [
      path.resolve(source),
      path.resolve(target)
    ])
  );

  return function resolveMappedTarget(request, parent) {
    const requestedPath = absoluteRequestPath(request, parent);
    if (requestedPath) return normalizedMapping.get(requestedPath) || null;

    if (request.startsWith('client/') || request.startsWith('common/')) {
      const suffix = `${path.sep}${request.split('/').join(path.sep)}`;
      const matches = [...normalizedMapping].filter(([source]) =>
        source.endsWith(suffix)
      );
      return matches.length === 1 ? matches[0][1] : null;
    }
    return null;
  };
}

function registerTypeScriptLoader(mapping) {
  const originalResolveFilename = Module._resolveFilename;
  const originalTypeScriptLoader = require.extensions['.ts'];
  const originalTypeScriptJsxLoader = require.extensions['.tsx'];
  const resolveMappedTarget = createMappedResolver(mapping);

  function compileRegisteredModule(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    module._compile(compileTypeScript(source, filename), filename);
  }

  Module._resolveFilename = function resolveMappedTypeScript(
    request,
    parent,
    isMain,
    options
  ) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (originalError) {
      const target = resolveMappedTarget(request, parent);
      if (!target) throw originalError;
      return originalResolveFilename.call(this, target, parent, isMain, options);
    }
  };

  require.extensions['.ts'] = compileRegisteredModule;
  require.extensions['.tsx'] = compileRegisteredModule;

  return function restoreTypeScriptLoader() {
    Module._resolveFilename = originalResolveFilename;
    if (originalTypeScriptLoader) {
      require.extensions['.ts'] = originalTypeScriptLoader;
    } else {
      delete require.extensions['.ts'];
    }
    if (originalTypeScriptJsxLoader) {
      require.extensions['.tsx'] = originalTypeScriptJsxLoader;
    } else {
      delete require.extensions['.tsx'];
    }
  };
}

module.exports = {
  compileTypeScript,
  createMappedResolver,
  registerTypeScriptLoader
};
