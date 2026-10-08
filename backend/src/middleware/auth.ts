import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { prisma } from '../services/database.js';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const requireAuth: RequestHandler = async (request, response, next) => {
  const token = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.authorization ?? '')?.[1];
  if (!token) { response.status(401).json({ error: 'Please sign in.' }); return; }
  try {
    const tokenHash = digest(token);
    const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, email: true } } } });
    if (!session || session.expiresAt <= new Date()) {
      response.status(401).json({ error: 'Your session has expired. Please sign in.' }); return;
    }
    response.locals.user = session.user;
    response.locals.tokenHash = tokenHash;
    next();
  } catch {
    response.status(503).json({ error: 'Unable to verify your session. Please try again.' });
  }
};

export const requireMatchOwner: RequestHandler = async (request, response, next) => {
  try {
    const id = String(request.params.matchId);
    const match = await prisma.match.findFirst({ where: { id, ownerId: response.locals.user.id }, select: { id: true } });
    if (!match) { response.status(404).json({ error: 'Match not found.' }); return; }
    next();
  } catch { response.status(503).json({ error: 'Unable to load the match.' }); }
};
export const requireInningsOwner: RequestHandler = async (request, response, next) => {
  try {
    const id = String(request.params.inningsId);
    const innings = await prisma.innings.findFirst({ where: { id, match: { ownerId: response.locals.user.id } }, select: { id: true } });
    if (!innings) { response.status(404).json({ error: 'Innings not found.' }); return; }
    next();
  } catch { response.status(503).json({ error: 'Unable to load the innings.' }); }
};
