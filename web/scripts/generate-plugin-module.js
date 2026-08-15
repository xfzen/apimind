/* eslint-disable */
// Generate client/plugin-module.js from the explicit built-in plugin registry.
// Usage: node scripts/generate-plugin-module.js
const fs = require('fs');
const path = require('path');
const { runtimePlugins } = require('../client/builtins/pluginRegistry.js');

function createScript(plugin) {
  const options = plugin.options ? JSON.stringify(plugin.options) : null;
  const importPath = plugin.importPath;
  return `    "${plugin.name}": { module: await loadPlugin(() => import('${importPath}'), '${plugin.name}'), options: ${options} }`;
}

function buildPluginModuleContent(plugins = runtimePlugins) {
  const scripts = plugins.map(createScript);

  const lines = [];
  lines.push('export default (async () => {');
  lines.push('  async function loadPlugin(load, name) {');
  lines.push('    try {');
  lines.push('      const mod = await load();');
  lines.push('      return mod.default || mod;');
  lines.push('    } catch (e) {');
  lines.push('      const message = e && e.message ? e.message : String(e);');
  lines.push('      console.warn(`[plugin] failed to load ${name}: ${message}`);');
  lines.push('      return null;');
  lines.push('    }');
  lines.push('  }');
  lines.push('  const registry = {');
  lines.push(scripts.join(',\n') );
  lines.push('  };');
  lines.push('  return registry;');
  lines.push('})();');

  return lines.join('\n');
}

function run() {
  const content = buildPluginModuleContent();
  fs.writeFileSync(path.resolve(__dirname, '../client/plugin-module.js'), content);
  // eslint-disable-next-line no-console
  console.log('Generated client/plugin-module.js with', runtimePlugins.length, 'plugins');
}

if (require.main === module) {
  run();
}

module.exports = {
  buildPluginModuleContent,
  run
};
