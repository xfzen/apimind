import test from 'ava';
import { isSafeEmail } from '../../common/validators.ts';

test('isSafeEmail accepts normal email addresses', t => {
  t.true(isSafeEmail('user.name+tag@example.com'));
});

test('isSafeEmail rejects malformed and pathological input', t => {
  const pathological = `${'a.'.repeat(20000)}@example.com`;
  t.false(isSafeEmail('missing-at.example.com'));
  t.false(isSafeEmail('user@localhost'));
  t.false(isSafeEmail(pathological));
});
