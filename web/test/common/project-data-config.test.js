import fs from 'fs';
import path from 'path';
import test from 'ava';
import { createExportModules } from '../../client/containers/Project/Setting/ProjectData/exporters.js';
import { createImportModules } from '../../client/containers/Project/Setting/ProjectData/importers.js';

const readFixture = filename =>
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', filename), 'utf8');

test('ProjectData has built-in importers compatible with old plugin run contract', async t => {
  const modules = createImportModules();

  t.deepEqual(Object.keys(modules).sort(), ['har', 'json', 'postman', 'swagger']);

  const cases = [
    ['swagger', fs.readFileSync(path.join(__dirname, '..', 'swagger.v2.json'), 'utf8')],
    ['postman', readFixture('import-postman.json')],
    ['har', readFixture('import-har.json')],
    ['json', readFixture('import-yapi-json.json')]
  ];

  for (const [name, raw] of cases) {
    t.is(typeof modules[name].run, 'function');
    const data = await modules[name].run(raw);

    t.true(Array.isArray(data.apis), `${name} should expose apis array`);
    t.true(Array.isArray(data.cats), `${name} should expose cats array`);
    t.true(data.apis.length > 0, `${name} should convert at least one interface`);

    const first = data.apis[0];
    t.truthy(first.title, `${name} first api should include title`);
    t.truthy(first.path, `${name} first api should include path`);
    t.truthy(first.method, `${name} first api should include method`);
  }
});

test('ProjectData has built-in exporters for legacy backend aliases', t => {
  const modules = createExportModules(42);

  t.deepEqual(Object.keys(modules).sort(), ['html', 'json', 'markdown', 'swaggerjson']);

  for (const name of Object.keys(modules)) {
    t.truthy(modules[name].route);
    t.true(modules[name].route.includes('pid=42'));
  }
});
