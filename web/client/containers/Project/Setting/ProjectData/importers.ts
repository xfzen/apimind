import swaggerRun from '../../../../../exts/yapi-plugin-import-swagger/run.js';
import * as postmanPlugin from '../../../../../exts/yapi-plugin-import-postman/client.js';
import * as harPlugin from '../../../../../exts/yapi-plugin-import-har/client.js';

type UnknownRecord = Record<string, unknown>;

export interface ImportResult extends UnknownRecord {
  apis: UnknownRecord[];
  cats: UnknownRecord[];
}

export interface ImportModule extends UnknownRecord {
  name: string;
  desc: string;
  run: (raw: string) => unknown | Promise<unknown>;
}

type ImportRegistry = Record<string, ImportModule>;
type HookHandler = (registry: ImportRegistry) => void;
type PluginInitializer = (this: {
  bindHook(name: string, handler: unknown): void;
}) => unknown;

function resolvePluginModule(plugin: unknown): unknown {
  if (plugin && typeof plugin === 'object' && 'default' in plugin) {
    return (plugin as { default: unknown }).default;
  }
  return plugin;
}

function registerImportPlugin(plugin: unknown, registry: ImportRegistry): void {
  const pluginModule = resolvePluginModule(plugin);
  if (typeof pluginModule !== 'function') {
    return;
  }

  (pluginModule as PluginInitializer).call({
    bindHook(name: string, handler: unknown) {
      if (name === 'import_data' && typeof handler === 'function') {
        (handler as HookHandler)(registry);
      }
    }
  });
}

function normalizeImportResult(result: unknown): ImportResult {
  const data =
    result && typeof result === 'object' ? (result as UnknownRecord) : {};
  return Object.assign({}, data, {
    apis: Array.isArray(data.apis) ? data.apis : [],
    cats: Array.isArray(data.cats) ? data.cats : []
  }) as ImportResult;
}

function wrapImporter(importer: ImportModule): ImportModule {
  if (!importer || typeof importer.run !== 'function') {
    return importer;
  }

  return Object.assign({}, importer, {
    async run(raw: string): Promise<ImportResult> {
      return normalizeImportResult(await importer.run(raw));
    }
  });
}

function createYapiJsonImporter(): ImportModule {
  return {
    name: 'json',
    desc: 'YApi接口 json数据导入',
    async run(raw: string): Promise<ImportResult> {
      const interfaceData: ImportResult = { apis: [], cats: [] };
      const groups = JSON.parse(raw) as Array<{
        name: unknown;
        desc: unknown;
        list: Array<UnknownRecord & { catname?: unknown }>;
      }>;

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

export function createImportModules(): ImportRegistry {
  const modules: ImportRegistry = {
    swagger: {
      name: 'Swagger',
      run: swaggerRun as (raw: string) => Promise<unknown>,
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
