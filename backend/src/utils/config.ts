export function parseEnv(source: NodeJS.ProcessEnv) {
  function integer(name: string, fallback: number, max: number) {
    const raw = source[name] ?? String(fallback);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new Error(`${name} must be an integer between 1 and ${max}.`);
    }
    return value;
  }
  const databaseUrl = source.DATABASE_URL;
  try {
    if (!databaseUrl || !['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('Invalid NODE_ENV.');
  const corsOrigins = (source.CORS_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of corsOrigins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error();
    } catch {
      throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths.');
    }
  }
  return {
    databaseUrl: databaseUrl!,
    port: integer('PORT', 3000, 65535),
    production: nodeEnv === 'production',
    corsOrigins,
    trustProxy: source.TRUST_PROXY ? source.TRUST_PROXY.split(',').map(value => value.trim()) : false,
    databasePoolSize: integer('DATABASE_POOL_SIZE', 10, 100),
    databaseTimeoutMs: integer('DATABASE_TIMEOUT_MS', 10000, 120000),
    shutdownTimeoutMs: integer('SHUTDOWN_TIMEOUT_MS', 15000, 120000),
  };
}
