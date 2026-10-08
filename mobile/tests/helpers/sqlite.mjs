import { DatabaseSync } from 'node:sqlite';
import { serialize } from '../../src/database/types.ts';
import { migrate } from '../../src/database/migrations.ts';
export async function openTestDatabase(path = ':memory:', owner = 'account-a') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const connection = {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...args) => db.prepare(sql).run(...args),
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => db.prepare(sql).all(...args),
  };
  const enqueue = serialize();
  const database = {
    transaction: work => enqueue(async () => {
      db.exec('BEGIN IMMEDIATE');
      try { const value = await work(connection); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }),
    close: () => db.close(),
  };
  try { await database.transaction(tx => migrate(tx, owner)); }
  catch (error) { db.close(); throw error; }
  return database;
}
