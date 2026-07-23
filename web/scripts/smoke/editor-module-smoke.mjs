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
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error(`timeout loading ${path}`));
    });
  });
}

const shim = await request('/client/shims/tui-editor.js');
if (shim.statusCode !== 200) {
  throw new Error(`editor shim status ${shim.statusCode}`);
}
if (!shim.body.includes('@toast-ui_editor') && !shim.body.includes('@toast-ui/editor')) {
  throw new Error('editor shim does not load @toast-ui/editor');
}

const editForm = await request('/client/containers/Project/Interface/InterfaceList/InterfaceEditForm.js');
if (editForm.statusCode !== 200) {
  throw new Error(`InterfaceEditForm status ${editForm.statusCode}`);
}
if (!editForm.body.includes('getHTML()')) {
  throw new Error('InterfaceEditForm does not call getHTML()');
}
if (editForm.body.includes('getHtml()')) {
  throw new Error('InterfaceEditForm still calls old getHtml()');
}

console.log('editor module smoke passed');
