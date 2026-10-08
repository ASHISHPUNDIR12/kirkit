import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [version, salt, hex] = stored.split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hex ?? '')) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hex, 'hex'));
}
export function validateCredentials(body: unknown): { email: string; password: string } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 128) return null;
  return { email: normalized, password };
}
