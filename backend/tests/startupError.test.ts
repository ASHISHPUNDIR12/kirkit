import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startupErrorMessage } from '../src/utils/startupError.js';

test('startup diagnostics identify DNS and nested connection errors', () => {
  assert.match(startupErrorMessage({ code: 'EAI_AGAIN' }), /EAI_AGAIN.*hostname lookup failed/);
  assert.match(startupErrorMessage({ cause: { errors: [{ code: 'ETIMEDOUT' }] } }), /ETIMEDOUT.*timed out/);
  assert.match(startupErrorMessage({ code: 'EADDRINUSE' }), /PORT is already in use/);
});
test('startup diagnostics omit credentials and handle unknown or cyclic errors', () => {
  const error = { message: 'postgresql://user:secret@host/db', code: 'secret', cause: {} };
  error.cause = error;
  assert.equal(startupErrorMessage(error), 'Backend startup failed. Check database connectivity, DATABASE_URL, and runtime configuration.');
  assert.ok(!startupErrorMessage({ code: 'EAI_AGAIN', message: error.message }).includes('secret'));
});
