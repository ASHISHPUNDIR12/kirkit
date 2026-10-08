import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../utils/env.js';

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  max: env.databasePoolSize,
  connectionTimeoutMillis: env.databaseTimeoutMs,
  statement_timeout: env.databaseTimeoutMs,
  idleTimeoutMillis: 30000,
});

export const prisma = new PrismaClient({ adapter });

export async function checkDatabaseConnection(): Promise<void> {
  // Read-only connectivity check; table changes are handled by migrations.
  await prisma.$queryRaw`SELECT 1`;
}
