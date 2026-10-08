import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword, validateCredentials } from '../src/utils/password.js';

test('passwords are salted, verified, and never stored as plaintext', async () => {
  const password = 'correct horse battery staple';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect password', first), false);
  assert.equal(await verifyPassword(password, 'broken'), false);
});
test('credential validation normalizes email without modifying passwords', () => {
  assert.deepEqual(validateCredentials({ email: ' Alice@Example.COM ', password: ' password with spaces ' }), { email: 'alice@example.com', password: ' password with spaces ' });
  for (const body of [null, [], {}, { email: 'not-an-email', password: 'long-enough-password' }, { email: 'a@b.com', password: 'short' }, { email: 'a@b.com', password: 'a'.repeat(129) }]) {
    assert.equal(validateCredentials(body), null);
  }
});
