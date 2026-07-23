const runtimePlugins = [
  {
    name: 'advanced-mock',
    importPath: '/exts/yapi-plugin-advanced-mock/client.js',
    options: null,
    hooks: ['interface_tab', 'add_reducer'],
    classification: 'legacy alias now, migrate later'
  },
  {
    name: 'wiki',
    importPath: '/exts/yapi-plugin-wiki/client.js',
    options: null,
    hooks: ['sub_nav'],
    classification: 'legacy alias now, migrate later'
  }
];

const migratedPlugins = [
  {
    name: 'import-postman',
    hooks: ['import_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/importers.js'
  },
  {
    name: 'import-har',
    hooks: ['import_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/importers.js'
  },
  {
    name: 'import-swagger',
    hooks: ['import_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/importers.js'
  },
  {
    name: 'import-yapi-json',
    hooks: ['import_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/importers.js'
  },
  {
    name: 'export-data',
    hooks: ['export_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/exporters.js'
  },
  {
    name: 'export-swagger2-data',
    hooks: ['export_data'],
    replacement: 'client/containers/Project/Setting/ProjectData/exporters.js'
  },
  {
    name: 'gen-services',
    hooks: ['sub_setting_nav'],
    replacement: 'client/containers/Project/Setting/settingTabs.js'
  }
];

const disabledPlugins = [
  {
    name: 'statistics',
    hooks: ['header_menu', 'app_route', 'mock_after'],
    reason: 'Go statistics routes and mock metrics persistence are not implemented.'
  },
  {
    name: 'swagger-auto-sync',
    hooks: ['sub_setting_nav'],
    reason: 'Go auto-sync persistence, safe fetch, scheduler, and sync logging are not implemented.'
  }
];

module.exports = {
  runtimePlugins,
  migratedPlugins,
  disabledPlugins
};
