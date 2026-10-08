import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../src/auth/sessionStore.ts';
const session = { token: 'a'.repeat(64), expiresAt: '2020-01-01T00:00:00.000Z', user: { id: 'account-a', email: 'a@example.test' } };
test('expired sessions restore local identity and invalidation/logout never depend on a network', async () => {
  let record = null;
  const storage = { read: async () => record, write: async value => { record = value; }, remove: async () => { record = null; } };
  let store = createSessionStore(storage);
  await store.restore(); await store.save({ ...session, password: 'must-not-persist' });
  assert.equal(record.includes('must-not-persist'), false);
  store = createSessionStore(storage); await store.restore();
  assert.equal(store.getSession().user.id, session.user.id);
  await store.invalidate(session.token);
  assert.equal(store.getSession().token, null); assert.equal(store.getSession().user.id, session.user.id);
  await assert.rejects(store.save({ ...session, user: { ...session.user, id: 'other' } }), /switching accounts/);
  await store.clear(); assert.equal(record, null); assert.equal(store.getSession(), null);
});
test('storage failures do not falsely publish a saved session or silently erase credentials', async () => {
  const store = createSessionStore({ read: async () => '{bad', write: async () => { throw new Error('disk'); }, remove: async () => { throw new Error('disk'); } });
  await store.restore(); assert.equal(store.getState().ready, false); assert.ok(store.getState().error);
  await assert.rejects(store.save(session), /securely save/); assert.equal(store.getSession(), null);
  await assert.rejects(store.clear(), /remove saved/);
});
