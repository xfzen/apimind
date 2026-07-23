import http from 'node:http';

const baseURL = process.env.YAPI_WEB_BASE_URL || 'http://127.0.0.1:4001';

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseURL}${path}`, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`timeout loading ${path}`)));
  });
}

const index = await request('/');
if (index.statusCode !== 200 || !index.body.includes('/client/index.jsx')) {
  throw new Error('Vite index page is not serving the YApi app entry');
}

const viteClient = await request('/@vite/client');
if (viteClient.statusCode !== 200 || !viteClient.body.includes('createHotContext')) {
  throw new Error('Vite HMR client is not available');
}

const appEntry = await request('/client/index.jsx');
if (appEntry.statusCode !== 200 || !appEntry.body.includes('renderInto(')) {
  throw new Error('YApi app entry is not transformed by Vite');
}

console.log('dev server smoke passed');
