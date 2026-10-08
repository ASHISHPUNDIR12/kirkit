import type { Request } from 'express';
import { ActionConflict, type Command } from '../services/actions.js';
export function commandFrom(request: Request): Command {
  const requestId = request.get('Idempotency-Key');
  const raw = request.get('X-Match-Revision');
  if (requestId !== undefined && !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) throw new ActionConflict('Invalid request ID.');
  if (raw !== undefined && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) throw new ActionConflict('Invalid match revision.');
  return { requestId, revision: raw === undefined ? undefined : Number(raw) };
}
