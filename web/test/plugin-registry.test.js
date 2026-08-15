import test from 'ava';
import {
  disabledPlugins,
  migratedPlugins,
  runtimePlugins
} from '../client/builtins/pluginRegistry.js';
import { buildPluginModuleContent } from '../scripts/generate-plugin-module.js';

test('runtime plugin registry is explicit and stable', t => {
  t.deepEqual(runtimePlugins.map(plugin => plugin.name), ['advanced-mock', 'wiki']);
  runtimePlugins.forEach(plugin => {
    t.true(plugin.importPath.startsWith('../exts/yapi-plugin-'));
    t.true(Array.isArray(plugin.hooks));
    t.truthy(plugin.classification);
  });
});

test('disabled plugins are explicitly classified', t => {
  const disabled = new Set(disabledPlugins.map(plugin => plugin.name));

  t.true(disabled.has('statistics'));
  t.true(disabled.has('swagger-auto-sync'));
});

test('migrated hook plugins are absent from runtime registry', t => {
  const runtimeNames = new Set(runtimePlugins.map(plugin => plugin.name));
  const migratedNames = new Set(migratedPlugins.map(plugin => plugin.name));
  const runtimeHooks = new Set(runtimePlugins.flatMap(plugin => plugin.hooks));

  ['import-postman', 'import-har', 'import-swagger', 'import-yapi-json'].forEach(name => {
    t.true(migratedNames.has(name));
    t.false(runtimeNames.has(name));
  });
  ['export-data', 'export-swagger2-data', 'gen-services'].forEach(name => {
    t.true(migratedNames.has(name));
    t.false(runtimeNames.has(name));
  });

  t.false(runtimeHooks.has('import_data'));
  t.false(runtimeHooks.has('export_data'));
  t.false(runtimeHooks.has('sub_setting_nav'));
});

test('plugin-module generation ignores arbitrary config plugins', t => {
  const content = buildPluginModuleContent();

  t.true(content.includes('"advanced-mock"'));
  t.true(content.includes('"wiki"'));
  t.false(content.includes('/node_modules/yapi-plugin-'));
  t.false(content.includes('swagger-auto-sync'));
  t.false(content.includes('statistics'));
});
