import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const baseURL = process.env.YAPI_WEB_BASE_URL || 'http://127.0.0.1:4001';
const apiURL = process.env.APIMIND_API_BASE_URL || baseURL;
const required = {
  react: '18.3.1',
  'react-dom': '18.3.1',
  antd: '6.4.3',
  '@ant-design/icons': '6.2.3',
  redux: '4.2.1',
  'react-redux': '8.1.3'
};

function assertPackageVersion(name, expected) {
  const pkg = require(`${name}/package.json`);
  if (pkg.version !== expected) {
    throw new Error(`${name} expected ${expected}, got ${pkg.version}`);
  }
  console.log(`${name}@${expected}: ok`);
}

function get(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error(`timeout ${url}`)));
  });
}

async function assertOK(label, url, predicate) {
  const response = await get(url);
  if (response.statusCode !== 200) {
    throw new Error(`${label} returned status ${response.statusCode}`);
  }
  if (predicate && !predicate(response)) {
    throw new Error(`${label} response did not match expected shape`);
  }
  console.log(`${label}: ok`);
}

await assertOK('web index', `${baseURL}/`, response => response.body.includes('/client/index.jsx'));
await assertOK('user status api', `${apiURL}/api/user/status`, response => {
  try {
    const data = JSON.parse(response.body);
    return Object.prototype.hasOwnProperty.call(data, 'errcode');
  } catch {
    return false;
  }
});
await assertOK('editor shim', `${baseURL}/client/shims/tui-editor.js`, response => {
  return response.body.includes('@toast-ui_editor') || response.body.includes('@toast-ui/editor');
});

Object.entries(required).forEach(([name, version]) => assertPackageVersion(name, version));

console.log('dependency smoke baseline passed');
