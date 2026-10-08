import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../services/database.js';
import { hashPassword, verifyPassword, validateCredentials } from '../utils/password.js';
import { digest, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
// A valid dummy hash makes unknown-account login do the same password work.
const dummyHash = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

for (const action of ['signup', 'login'] as const) {
  authRouter.post(`/${action}`, async (request, response) => {
    const credentials = validateCredentials(request.body);
    if (!credentials) {
      response.status(400).json({ error: 'Enter a valid email and a password of at least 12 characters (maximum 128 bytes).' }); return;
    }
    try {
      // Atomic shared limits work across replicas; never log IPs or email addresses.
      for (const [key, limit] of [[digest(`ip:${request.ip}`), 40], [digest(`email:${credentials.email}`), 10]] as const) {
        const rows = await prisma.$queryRaw<{ hits: number }[]>`
          INSERT INTO "AuthThrottle" ("key", "hits", "expiresAt") VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
          ON CONFLICT ("key") DO UPDATE SET
            "hits" = CASE WHEN "AuthThrottle"."expiresAt" <= NOW() THEN 1 ELSE "AuthThrottle"."hits" + 1 END,
            "expiresAt" = CASE WHEN "AuthThrottle"."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "AuthThrottle"."expiresAt" END
          RETURNING "hits"`;
        if (rows[0].hits > limit) {
          response.setHeader('Retry-After', '900');
          response.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' }); return;
        }
      }
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      let user;
      if (action === 'signup') {
        user = await prisma.user.create({ data: {
          email: credentials.email, passwordHash: await hashPassword(credentials.password),
          sessions: { create: { tokenHash: digest(token), expiresAt } },
        } });
      } else {
        user = await prisma.user.findUnique({ where: { email: credentials.email } });
        const valid = await verifyPassword(credentials.password, user?.passwordHash ?? dummyHash);
        if (!user || !valid) { response.status(401).json({ error: 'Incorrect email or password.' }); return; }
        await prisma.session.create({ data: { tokenHash: digest(token), userId: user.id, expiresAt } });
      }
      response.status(action === 'signup' ? 201 : 200).json({ token, expiresAt, user: { id: user.id, email: user.email } });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        response.status(409).json({ error: 'Unable to create this account. Try signing in.' });
      } else {
        console.error('Authentication request failed.');
        response.status(503).json({ error: 'Authentication is temporarily unavailable. Please try again.' });
      }
    }
  });
}
authRouter.get('/me', requireAuth, (_request, response) => { response.json({ user: response.locals.user }); });
authRouter.post('/logout', requireAuth, async (_request, response) => {
  try {
    await prisma.session.deleteMany({ where: { tokenHash: response.locals.tokenHash } });
    response.json({ status: 'ok' });
  } catch { response.status(503).json({ error: 'Unable to sign out. Please try again.' }); }
});
