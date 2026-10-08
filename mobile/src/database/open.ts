import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { migrate } from './migrations';
import { serialize, type LocalDatabase, type SqlConnection } from './types';

const connections = new Map<string, Promise<LocalDatabase>>();

export function databaseFilename(userId: string) {
  // Server IDs are CUIDs; accept UUIDs too, without permitting path separators.
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) throw new Error('Invalid account identity. Please sign in again.');
  return `kirkit-${userId}.db`;
}

export function openAccountDatabase(userId: string): Promise<LocalDatabase> {
  const filename = databaseFilename(userId);
  const existing = connections.get(userId);
  if (existing) return existing;
  const opening = (async () => {
    if (__DEV__) console.info('[scorebook] opening local SQLite database');
    const db = await SQLite.openDatabaseAsync(filename);
    if (__DEV__) console.info('[scorebook] SQLite opened; preparing local schema');
    const enqueue = serialize();
    const database: LocalDatabase = {
      transaction: <T>(work: (tx: SqlConnection) => Promise<T>) => enqueue(async () => {
        let value: unknown;
        if (Platform.OS === 'web') {
          // All access goes through this queue; no unrelated web queries can enter the transaction.
          await db.withTransactionAsync(async () => { value = await work(db); });
        } else await db.withExclusiveTransactionAsync(async tx => { value = await work(tx); });
        return value as T;
      }),
    };
    try {
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      await database.transaction(tx => migrate(tx, userId));
      if (__DEV__) console.info('[scorebook] local schema ready');
      return database;
    } catch (error) {
      if (__DEV__) console.warn('[scorebook] local database initialization failed', error instanceof Error ? error.message : 'unknown error');
      await db.closeAsync().catch(() => undefined);
      throw error;
    }
  })();
  connections.set(userId, opening);
  void opening.catch(() => { connections.delete(userId); });
  return opening;
}
