/* eslint-disable */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const pkg = require('./package.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

const vendorsLib = [
  'react',
  'react-dom',
  'redux',
  'redux-promise',
  'react-router',
  'react-router-dom',
  'prop-types'
];
const vendorsLib2 = ['brace', 'json5', 'url', 'axios'];
const vendorsLib3 = ['mockjs', 'moment'];

const usePolling = String(process.env.VITE_USE_POLLING || '').toLowerCase() === 'true';
const webPort = Number(process.env.YAPI_WEB_PORT || 4000);
const webHost = process.env.YAPI_WEB_HOST || '127.0.0.1';
const openBrowser = String(process.env.VITE_OPEN || '').toLowerCase() === 'true';

// 后端服务地址（Docker Compose 里指向 apimind 服务，本机开发默认指向 localhost）
const BACKEND_TARGET = process.env.YAPI_API_TARGET || 'http://127.0.0.1:8888';

// 简单直观的本地代理配置（直接在本文件顶部配置）
// 开发期默认走代理，如需改后端 IP/端口，只改这里即可
const DEV_PROXY = {
  target: BACKEND_TARGET, // 后端服务 IP:端口
  path: process.env.YAPI_API_PROXY_PATH || '/api', // 需要代理的前缀
  mockPath: process.env.YAPI_MOCK_PROXY_PATH || '/mock', // mock server 前缀
  rewrite: String(process.env.YAPI_API_PROXY_REWRITE || '').toLowerCase() === 'true' // 如果后端没有 '/api' 前缀，设为 true
};

// Dev server proxy configuration
function buildProxyFromConfig(cfg) {
  if (!cfg || typeof cfg.target !== 'string' || !cfg.target) return undefined;
  const paths = [cfg.path || '/api', cfg.mockPath || '/mock'].filter(Boolean);
  return paths.reduce((proxy, p) => {
    proxy[p] = {
      target: cfg.target,
      changeOrigin: true,
      ws: true,
      secure: false,
      rewrite: cfg.rewrite ? (urlPath) => urlPath.replace(new RegExp(`^${p}`), '') : undefined
    };
    return proxy;
  }, {});
}

const devProxy = buildProxyFromConfig(DEV_PROXY);

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  publicDir: 'static',
  plugins: [
    // Remove CommonJS transform for local sources to avoid transform crashes.
    {
      name: 'pre-babel-jsx-in-js',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('.js')) return null;
        const isVendorJsx = id.includes('/node_modules/json-schema-editor-visual/package/');
        const isAdvancedMock = id.endsWith('/exts/yapi-plugin-advanced-mock/AdvMock.js');
        const isExtClient = id.includes('/exts/') && id.endsWith('/client.js');
        if (id.includes('/node_modules/') && !isVendorJsx) return null;
        if (isVendorJsx || isAdvancedMock || isExtClient) {
          code = code.replace(/module\.exports\s*=/, 'export default ');
        }
        try {
          const result = babel.transformSync(code, {
            filename: id,
            babelrc: false,
            configFile: false,
            presets: [
              [require.resolve('@babel/preset-react'), { runtime: 'classic' }]
            ],
            plugins: [
              [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
              [require.resolve('@babel/plugin-proposal-class-properties'), { loose: true }]
            ],
            sourceMaps: true
          });
          return { code: result.code, map: result.map };
        } catch (e) {
          return null;
        }
      }
    },
    react({
      include: [/\.jsx?$/, /\.tsx?$/],
      jsxRuntime: 'classic',
      babel: {
        plugins: [
          [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
          [require.resolve('@babel/plugin-proposal-class-properties'), { loose: true }],
          [require.resolve('@babel/plugin-transform-runtime'), { regenerator: true }]
        ],
        presets: [],
        parserOpts: {
          plugins: ['jsx', 'decorators-legacy', 'classProperties']
        }
      }
    })
  ],
  resolve: {
    alias: [
      { find: 'client', replacement: path.resolve(__dirname, 'client') },
      { find: 'common', replacement: path.resolve(__dirname, 'common') },
      { find: 'exts', replacement: path.resolve(__dirname, 'exts') },
      // Use Sass Embedded implementation for better performance and to avoid legacy-JS-API warnings
      { find: 'sass', replacement: 'sass-embedded' },
      { find: /^axios-runtime$/, replacement: path.resolve(__dirname, 'node_modules/axios/index.js') },
      { find: /^axios$/, replacement: path.resolve(__dirname, 'client/utils/request.js') },
      { find: /^moment$/, replacement: path.resolve(__dirname, 'client/shims/moment.js') },
      { find: 'react-is', replacement: path.resolve(__dirname, 'client/shims/react-is.js') }
    ]
  },
  define: {
    __YAPI_API_BASE__: JSON.stringify(process.env.YAPI_API_BASE || ''),
    'process.platform': JSON.stringify('browser'),
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || (isProd ? 'production' : 'development')),
      version: JSON.stringify(pkg.version),
      API_BASE: JSON.stringify(process.env.YAPI_API_BASE || '')
    },
    global: 'globalThis'
  },
  server: {
    port: webPort,
    host: webHost,
    open: openBrowser,
    // With Node 20, native fsevents works. Keep polling only when explicitly enabled.
    watch: usePolling ? { usePolling: true, interval: 100 } : undefined,
    proxy: devProxy
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Prefer the modern Sass compiler API to avoid legacy-js-api warnings
        api: 'modern-compiler',
        // Optionally silence specific deprecations (keeps logs clean during migration)
        silenceDeprecations: ['legacy-js-api', 'import']
      },
      sass: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api', 'import']
      },
      less: {
        javascriptEnabled: true,
        math: 'always'
      }
    }
  },
  optimizeDeps: {
    // npm resolves this file dependency to vendor/, so Vite treats it as source unless forced.
    // Pre-bundling restores the CommonJS default export used by the browser application.
    include: ['@apimind/mockjs-safe'],
    // esbuild pre-bundler needs to parse our source which uses JSX in .js files
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      },
      resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      define: {
        global: 'globalThis'
      }
    },
    // Ensure CommonJS consumers (antd LocaleProvider) see moment's instance functions
    needsInterop: ['@apimind/mockjs-safe', 'moment', 'json-schema-editor-visual', 'react-is']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: '.',
    manifest: true,
    commonjsOptions: {
      include: [/node_modules\/.+/, /common\/.+/, /client\/.+/, /vendor\/mockjs-safe\/.+/],
      requireReturnsDefault: 'preferred',
      defaultIsModuleExports: 'auto',
      transformMixedEsModules: isProd
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name]@[hash].js',
        chunkFileNames: '[name]@[hash].js',
        assetFileNames: '[name]@[hash][extname]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const match = (arr) => arr.some(name => id.includes(`/node_modules/${name}/`));
          if (match(vendorsLib)) return 'lib';
          if (match(vendorsLib2)) return 'lib2';
          if (match(vendorsLib3)) return 'lib3';
        }
      }
    }
  }
});
