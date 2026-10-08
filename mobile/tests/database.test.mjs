import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDatabase } from './helpers/sqlite.mjs';
import { migrate } from '../src/database/migrations.ts';

test('migrations preserve records across reopen, enforce relationships and rollback', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kirkit-db-'));
  const path = join(dir, 'scores.db');
  let db;
  try {
    db = await openTestDatabase(path);
    await db.transaction(tx => tx.runAsync('INSERT INTO teams VALUES (?,?,?)', 't', 'Tigers', 'tigers'));
    await db.transaction(tx => migrate(tx, 'account-a'));
    await assert.rejects(db.transaction(tx => tx.runAsync('INSERT INTO players VALUES (?,?,?,?)', 'p', 'missing', 'A', 'a')));
    await assert.rejects(db.transaction(async tx => {
      await tx.runAsync('INSERT INTO teams VALUES (?,?,?)', 'bad', 'Rollback', 'rollback');
      throw new Error('Simulated interrupted write');
    }));
    db.close(); db = undefined;
    db = await openTestDatabase(path);
    assert.equal((await db.transaction(tx => tx.getAllAsync('SELECT * FROM teams'))).length, 1);
    await assert.rejects(db.transaction(tx => migrate(tx, 'other-account')), /another account/);
    await assert.rejects(db.transaction(async tx => {
      await tx.execAsync('PRAGMA user_version=999');
      await migrate(tx, 'account-a');
    }), /newer app/);
  } finally { db?.close(); await rm(dir, { recursive: true, force: true }); }
});
