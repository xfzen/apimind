import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

import { mockRuntimeStub } from './vite-runtime.mjs';

const webRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const runtimeKey = '__APIMIND_REDUX_TEST_RUNTIME__';

const axiosModule = `
const runtime = globalThis.${runtimeKey};
function request(method, url, configOrBody, config) {
  const call = { method, url, configOrBody, config };
  runtime.axiosCalls.push(call);
  const response = typeof runtime.response === 'function'
    ? runtime.response(call)
    : runtime.response;
  return Promise.resolve(response);
}
const axios = {
  get(url, config) { return request('get', url, config, undefined); },
  post(url, body, config) { return request('post', url, body, config); }
};
export default axios;
`;

const antdModule = `
const runtime = globalThis.${runtimeKey};
export const message = {
  error(text) { runtime.messages.push({ level: 'error', text }); },
  success(text) { runtime.messages.push({ level: 'success', text }); }
};
export default { message };
`;

const pluginModule = `
const runtime = globalThis.${runtimeKey};
export function emitHook(name, registry) {
  if (name === 'add_reducer') Object.assign(registry, runtime.pluginReducers);
}
`;

function reduxRuntimeStub() {
  const virtualModules = new Map([
    ['redux-test-axios', ['\0apimind-redux-test-axios', axiosModule]],
    ['redux-test-plugin', ['\0apimind-redux-test-plugin', pluginModule]],
    ['redux-test-antd', ['\0apimind-redux-test-antd', antdModule]],
    ['antd', ['\0apimind-redux-test-antd', antdModule]],
    ['client/plugin.js', ['\0apimind-redux-test-plugin', pluginModule]]
  ]);

  return {
    name: 'apimind-redux-test-runtime',
    enforce: 'pre',
    resolveId(id) {
      return virtualModules.get(id)?.[0] ?? null;
    },
    load(id) {
      for (const [, [virtualId, source]] of virtualModules) {
        if (id === virtualId) return source;
      }
      return null;
    },
    transform(code, id) {
      if (!id.includes('/client/reducer/') || !/\.[jt]s$/.test(id)) return null;
      return code
        .replace(/from ['"]axios['"]/g, "from 'redux-test-axios'")
        .replace(/from ['"]antd['"]/g, "from 'redux-test-antd'")
        .replace(/from ['"]client\/plugin\.js['"]/g, "from 'redux-test-plugin'");
    }
  };
}

export async function createReduxRuntimeServer(options = {}) {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const originalWindow = globalThis.window;
  const originalRuntime = globalThis[runtimeKey];
  const runtime = {
    axiosCalls: [],
    messages: [],
    pluginReducers: options.pluginReducers ?? {},
    response: options.response ?? {
      data: { errcode: 0, errmsg: '成功', data: null }
    }
  };

  globalThis[runtimeKey] = runtime;
  globalThis.window = {
    location: {
      hash: options.locationHash ?? '#/'
    }
  };

  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    plugins: [reduxRuntimeStub(), mockRuntimeStub()],
    resolve: {
      alias: [
        { find: /^antd$/, replacement: '\0apimind-redux-test-antd' },
        { find: /^client\/plugin\.js$/, replacement: '\0apimind-redux-test-plugin' }
      ]
    },
    server: { middlewareMode: true }
  });

  return {
    server,
    axiosCalls: runtime.axiosCalls,
    messages: runtime.messages,
    pluginReducers: runtime.pluginReducers,
    async restore() {
      await server.close();
      if (hadWindow) globalThis.window = originalWindow;
      else delete globalThis.window;
      if (originalRuntime === undefined) delete globalThis[runtimeKey];
      else globalThis[runtimeKey] = originalRuntime;
    }
  };
}
