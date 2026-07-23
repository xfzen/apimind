export function createExportModules(pid) {
  return {
    html: {
      name: 'html',
      route: `/api/plugin/export?type=html&pid=${pid}`,
      desc: '导出项目接口文档为 html 文件'
    },
    markdown: {
      name: 'markdown',
      route: `/api/plugin/export?type=markdown&pid=${pid}`,
      desc: '导出项目接口文档为 markdown 文件'
    },
    json: {
      name: 'json',
      route: `/api/plugin/export?type=json&pid=${pid}`,
      desc: '导出项目接口文档为 json 文件,可使用该文件导入接口数据'
    },
    swaggerjson: {
      name: 'swaggerjson',
      route: `/api/plugin/exportSwagger?type=OpenAPIV2&pid=${pid}`,
      desc: '导出项目接口文档为(Swagger 2.0)Json文件'
    }
  };
}

export default createExportModules;
