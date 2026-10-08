import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from './database.js';

// Retry only rolled-back serialization conflicts, never ambiguous connection failures.
export async function serializableTransaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (attempt >= 3 || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2034') throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt + Math.random() * 25));
    }
  }
}
