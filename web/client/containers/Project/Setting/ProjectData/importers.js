import swaggerRun from '../../../../../exts/yapi-plugin-import-swagger/run.js';
import postmanPlugin from '../../../../../exts/yapi-plugin-import-postman/client.js';
import harPlugin from '../../../../../exts/yapi-plugin-import-har/client.js';

function resolvePluginModule(plugin) {
  return plugin && plugin.default ? plugin.default : plugin;
}

function registerImportPlugin(plugin, registry) {
  const pluginModule = resolvePluginModule(plugin);
  if (typeof pluginModule !== 'function') {
    return;
  }

  pluginModule.call({
    bindHook(name, handler) {
      if (name === 'import_data' && typeof handler === 'function') {
        handler(registry);
      }
    }
  });
}

function normalizeImportResult(result) {
  const data = result && typeof result === 'object' ? result : {};
  return Object.assign({}, data, {
    apis: Array.isArray(data.apis) ? data.apis : [],
    cats: Array.isArray(data.cats) ? data.cats : []
  });
}

function wrapImporter(importer) {
  if (!importer || typeof importer.run !== 'function') {
    return importer;
  }

  return Object.assign({}, importer, {
    async run(raw) {
      return normalizeImportResult(await importer.run(raw));
    }
  });
}

function createYapiJsonImporter() {
  return {
    name: 'json',
    desc: 'YApi接口 json数据导入',
    async run(raw) {
      const interfaceData = { apis: [], cats: [] };
      const groups = JSON.parse(raw);

      groups.forEach(item => {
        interfaceData.cats.push({
          name: item.name,
          desc: item.desc
        });
        item.list.forEach(api => {
          api.catname = item.name;
        });
        interfaceData.apis = interfaceData.apis.concat(item.list);
      });

      return interfaceData;
    }
  };
}

export function createImportModules() {
  const modules = {
    swagger: {
      name: 'Swagger',
      run: swaggerRun,
      desc: 'Swagger数据导入（支持 v2.0+ ）'
    }
  };

  registerImportPlugin(postmanPlugin, modules);
  registerImportPlugin(harPlugin, modules);
  modules.json = createYapiJsonImporter();

  Object.keys(modules).forEach(name => {
    modules[name] = wrapImporter(modules[name]);
  });

  return modules;
}

export default createImportModules;
