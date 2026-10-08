import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEnv } from '../src/utils/config.js';

const DATABASE_URL = 'postgresql://user:password@localhost/test';
test('configuration accepts production settings and applies bounded defaults', () => {
  const env = parseEnv({ DATABASE_URL, NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com, http://localhost:8081', PORT: '8080' });
  assert.equal(env.production, true);
  assert.equal(env.legacyScoringEnabled, false);
  assert.equal(env.legacyExportEnabled, false);
  assert.equal(env.port, 8080);
  assert.equal(env.databasePoolSize, 10);
  assert.deepEqual(env.corsOrigins, ['https://app.example.com', 'http://localhost:8081']);
});
test('legacy cloud scoring and export require explicit opt-in outside integration tests', () => {
  const env = parseEnv({ DATABASE_URL, NODE_ENV: 'development', LEGACY_SCORING_ENABLED: 'true', ENABLE_LEGACY_EXPORT: 'true' });
  assert.equal(env.legacyScoringEnabled, true);
  assert.equal(env.legacyExportEnabled, true);
  assert.equal(parseEnv({ DATABASE_URL, NODE_ENV: 'test' }).legacyScoringEnabled, true);
});
test('configuration fails early without exposing connection credentials', () => {
  for (const DATABASE_URL of [undefined, '', 'https://secret:password@localhost/db']) {
    assert.throws(() => parseEnv({ DATABASE_URL }), /^Error: DATABASE_URL must be a PostgreSQL connection URL\.$/);
  }
  for (const PORT of ['', '0', '65536', '1.5', '1e3']) assert.throws(() => parseEnv({ DATABASE_URL, PORT }));
  for (const CORS_ORIGINS of ['*', 'null', 'https://example.com/', 'https://example.com/path']) {
    assert.throws(() => parseEnv({ DATABASE_URL, CORS_ORIGINS }));
  }
  assert.throws(() => parseEnv({ DATABASE_URL, NODE_ENV: 'prod' }));
  assert.throws(() => parseEnv({ DATABASE_URL, DATABASE_POOL_SIZE: '0' }));
  assert.throws(() => parseEnv({ DATABASE_URL, DATABASE_TIMEOUT_MS: '99999999' }));
});
