import test from 'ava';
import { isSystemProjectKind } from '../../client/components/ProjectCard/projectKind.ts';

test('isSystemProjectKind protects docs and template projects only', t => {
  t.true(isSystemProjectKind('docs'));
  t.true(isSystemProjectKind('template'));
  t.false(isSystemProjectKind('api'));
  t.false(isSystemProjectKind(''));
  t.false(isSystemProjectKind(undefined));
});
