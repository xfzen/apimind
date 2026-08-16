import fs from 'fs';
import path from 'path';
import test from 'ava';

test('advanced mock has mockCol reducer available at store initialization', t => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'reducer', 'modules', 'reducer.ts'),
    'utf8'
  );

  t.true(source.includes("import mockCol from './mockCol';"));
  t.regex(source, /const fixedReducerModules = \{[\s\S]*\bmockCol\b[\s\S]*\};/);
  t.regex(source, /const reducerModules = \{\s*\.\.\.fixedReducerModules\s*\}/);
});

test('advanced mock initializes Ace after the script container is mounted', t => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'exts', 'yapi-plugin-advanced-mock', 'AdvMock.js'),
    'utf8'
  );

  t.false(source.includes('componentWillMount()'));
  t.true(source.includes('componentDidMount()'));
});
