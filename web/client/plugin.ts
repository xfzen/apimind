type HookListener = (...args: unknown[]) => unknown;
type Hook =
  | { type: 'component'; mulit: false; listener: unknown }
  | { type: 'listener'; mulit: false; listener: unknown }
  | { type: 'listener'; mulit: true; listener: unknown[] };

interface PluginModule {
  hooks: Record<string, Hook>;
  bindHook: typeof bindHook;
  emitHook: typeof emitHook;
}

type PluginInitializer = (this: PluginModule, options: unknown) => unknown;

let pluginModule: PluginModule;
let readyResolve: ((ready: boolean) => void) | undefined;
const ready = new Promise<boolean>((resolve) => { readyResolve = resolve; });

/**
 * type component  组件
 *      listener   监听函数
 * mulit 是否绑定多个监听函数
 */

const hooks: Record<string, Hook> = {
  /**
   * 第三方登录 //可参考 yapi-plugin-qsso 插件
   */
  third_login: {
    type: 'component',
    mulit: false,
    listener: null
  },
  /**
   * 导入数据
   * @param Object importDataModule
   *
   * @info
   * 可参考 vendors/exts/yapi-plugin-import-swagger插件
   * importDataModule = {};
   */
  import_data: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 导出数据
   * @param Object exportDataModule
   * @param projectId
   * @info
   * exportDataModule = {};
   * exportDataModule.pdf = {
   *   name: 'Pdf',
   *   route: '/api/plugin/export/pdf',
   *   desc: '导出项目接口文档为 pdf 文件'
   * }
   */
  export_data: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 接口页面 tab 钩子
   * @param InterfaceTabs
   *
   * @info
   * 可参考 vendors/exts/yapi-plugin-advanced-mock
   * let InterfaceTabs = {
      view: {
        component: View,
        name: '预览'
      },
      edit: {
        component: Edit,
        name: '编辑'
      },
      run: {
        component: Run,
        name: '运行'
      }
    }
   */
  interface_tab: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 在运行页面或单个测试也里每次发送请求前调用
   * 可以用插件针对某个接口的请求头或者数据进行修改或者记录
  */
  before_request: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 在运行页面或单个测试也里每次发送完成后调用
   * 返回值为响应原始值 + 
   * {
   *   type: 'inter' | 'case',
   *   projectId: string,
   *   interfaceId: string
   * }
  */
  after_request: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 在测试集里运行每次发送请求前调用
  */
  before_col_request: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * 在测试集里运行每次发送请求后调用
   * 返回值为响应原始值 + 
   * {
   *   type: 'col',
   *   caseId: string,
   *   projectId: string,
   *   interfaceId: string
   * }
  */
  after_col_request: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * header下拉菜单 menu 钩子
   * @param HeaderMenu
   *
   * @info
   * 可参考 vendors/exts/yapi-plugin-statistics
   * let HeaderMenu = {
  user: {
    path: '/user/profile',
    name: '个人中心',
    icon: 'user',
    adminFlag: false
  },
  star: {
    path: '/follow',
    name: '我的关注',
    icon: 'star-o',
    adminFlag: false
  },
  solution: {
    path: '/user/list',
    name: '用户管理',
    icon: 'solution',
    adminFlag: true

  },
  logout: {
    path: '',
    name: '退出',
    icon: 'logout',
    adminFlag: false

  }
};
   */
  header_menu: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /**
   * Route路由列表钩子
   * @param AppRoute
   *
   * @info
   * 可参考 vendors/exts/yapi-plugin-statistics
   * 添加位置在Application.js 中
   * let AppRoute = {
  home: {
    path: '/',
    component: Home
  },
  group: {
    path: '/group',
    component: Group
  },
  project: {
    path: '/project/:id',
    component: Project
  },
  user: {
    path: '/user',
    component: User
  },
  follow: {
    path: '/follow',
    component: Follows
  },
  addProject: {
    path: '/add-project',
    component: AddProject
  },
  login: {
    path: '/login',
    component: Login
  }
};
};
   */
  app_route: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /*
   * 添加 reducer
   * @param Object reducerModules
   * 
   * @info
   * importDataModule = {}; 
   */

  add_reducer: {
    type: 'listener',
    mulit: true,
    listener: []
  },

  /*
   * 添加 subnav 钩子
   * @param Object reducerModules
   * 
   *  let routers = {
      interface: { name: '接口', path: "/project/:id/interface/:action", component:Interface },
      activity: { name: '动态', path: "/project/:id/activity", component:  Activity},
      data: { name: '数据管理', path: "/project/:id/data",  component: ProjectData},
      members: { name: '成员管理', path: "/project/:id/members" , component: ProjectMember},
      setting: { name: '设置', path: "/project/:id/setting" , component: Setting}
    }
   */
  sub_nav: {
    type: 'listener',
    mulit: true,
    listener: []
  },
  /*
   * 添加项目设置 nav
   * @param Object routers
   * 
   *  let routers = {
      interface: { name: 'xxx', component: Xxx },
    }
   */
  sub_setting_nav:{
    type: 'listener',
    mulit: true,
    listener: []
  }
};

function bindHook(name: string, listener: unknown): void {
  if (!name) {
    throw new Error('缺少hookname');
  }
  if (name in hooks === false) {
    throw new Error('不存在的hookname');
  }
  if (hooks[name].mulit === true) {
    hooks[name].listener.push(listener);
  } else {
    hooks[name].listener = listener;
  }
}

function emitHook(name: string, ...args: unknown[]): unknown {
  if (!hooks[name]) {
    throw new Error('不存在的hook name');
  }
  const hook = hooks[name];
  if (hook.mulit === true && hook.type === 'listener') {
    if (Array.isArray(hook.listener)) {
      const promiseAll: Promise<unknown>[] = [];
      hook.listener.forEach(item => {
        if (typeof item === 'function') {
          promiseAll.push(Promise.resolve(item.call(pluginModule, ...args)));
        }
      });
      return Promise.all(promiseAll);
    }
  } else if (hook.mulit === false && hook.type === 'listener') {
    if (typeof hook.listener === 'function') {
      return Promise.resolve(hook.listener.call(pluginModule, ...args));
    }
  } else if (hook.type === 'component') {
    return hook.listener;
  }
}

pluginModule = {
  hooks: hooks,
  bindHook: bindHook,
  emitHook: emitHook
};

// Load generated plugin registry (ESM returning a Promise)
import pluginRegistryPromise from './plugin-module.js';

(async () => {
  try {
    const pluginModuleList = await pluginRegistryPromise;
    Object.keys(pluginModuleList).forEach(plugin => {
      const registration = pluginModuleList[plugin];
      if (!registration) return null;
      if (typeof registration.module === 'function') {
        (registration.module as PluginInitializer).call(
          pluginModule,
          registration.options
        );
      }
    });
    if (typeof readyResolve === 'function') readyResolve(true);
  } catch (e) {
    // ignore
    if (typeof readyResolve === 'function') readyResolve(false);
  }
})();

export default pluginModule;
export { bindHook as bind, emitHook, ready };
