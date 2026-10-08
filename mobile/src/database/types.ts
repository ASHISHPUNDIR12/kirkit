/** The small SQL interface used by repositories; Expo SQLite implements it. */
export type SqlValue = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}
export interface LocalDatabase {
  /** Reads also use this queue so a scorecard cannot see half of a scoring action. */
  transaction<T>(work: (tx: SqlConnection) => Promise<T>): Promise<T>;
}

export function serialize() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
}
