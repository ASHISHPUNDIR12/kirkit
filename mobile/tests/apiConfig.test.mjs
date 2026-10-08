import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiConfig } from '../src/services/apiConfig.ts';

test('physical devices need an explicit reachable address', () => {
  for (const value of [undefined, '', 'http://0.0.0.0:3000']) {
    assert.ok(resolveApiConfig(value, 'android').error);
  }
  assert.equal(resolveApiConfig(undefined, 'web').url, 'http://localhost:3000');
  const simulator = resolveApiConfig('http://localhost:3000', 'ios');
  assert.equal(simulator.error, null);
  assert.ok(simulator.warning);
  assert.equal(resolveApiConfig('http://localhost:3000', 'web').warning, null);
});
test('LAN and HTTPS backend origins are normalized for auth paths', () => {
  for (const [input, expected] of [
    [' http://192.168.1.10:3000/ ', 'http://192.168.1.10:3000'],
    ['https://example.trycloudflare.com///', 'https://example.trycloudflare.com'],
    ['http://10.0.2.2:3000', 'http://10.0.2.2:3000'],
  ]) {
    const config = resolveApiConfig(input, 'android');
    assert.equal(config.error, null);
    assert.equal(`${config.url}/auth/login`, `${expected}/auth/login`);
    assert.equal(`${config.url}/auth/signup`, `${expected}/auth/signup`);
  }
});
test('invalid configuration never discloses embedded credentials', () => {
  for (const value of ['ftp://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com/#secret', 'http://example.com/auth', 'not a URL']) {
    const config = resolveApiConfig(value, 'android');
    assert.equal(config.url, '');
    assert.ok(config.error);
    assert.ok(!config.error.includes('secret'));
  }
});
