import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, Innings, PlayerInnings } from '../generated/prisma/client.js';
import { serializableTransaction } from './transaction.js';
import { readScoreboard } from './scoreboard.js';
import { linkRosterPlayers } from './rosterService.js';

export class ActionConflict extends Error {}
export type Command = { requestId?: string; revision?: number };
type Snapshot = {
  innings: Pick<Innings, 'runs' | 'wickets' | 'completedOvers' | 'ballsInCurrentOver' | 'pendingBatsmanRole' | 'status'>;
  match: { status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED'; currentInnings: number; firstInningsRuns: number | null; firstInningsWickets: number | null; target: number | null; winner: string | null; result: string | null };
  players: PlayerInnings[];
  sequence: number;
};

export function applyAction(id: string, kind: string, payload: unknown, command: Command, work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  const requestId = command.requestId ?? randomUUID();
  const fingerprint = createHash('sha256').update(JSON.stringify({ id, kind, payload })).digest('hex');
  return serializableTransaction(async tx => {
    const before = await tx.innings.findUniqueOrThrow({ where: { id }, include: { players: true, match: true, ballEvents: { orderBy: { sequence: 'desc' }, take: 1 } } });
    const old = await tx.matchAction.findUnique({ where: { matchId_requestId: { matchId: before.matchId, requestId } } });
    if (old) {
      if (old.fingerprint !== fingerprint) throw new ActionConflict('This request ID was already used for a different action.');
      return readScoreboard(tx, id); // Replays never apply a delivery, even after undo.
    }
    if (command.revision !== undefined && command.revision !== before.match.revision) throw new ActionConflict('The score has changed. Refresh the scoreboard before scoring again.');
    if (before.match.currentInnings !== before.inningsNumber) throw new ActionConflict('Only the current innings can be changed.');
    // Updating the shared match row serializes all actions, including undo and innings completion.
    await tx.match.update({ where: { id: before.matchId }, data: { revision: { increment: 1 } } });
    const { runs, wickets, completedOvers, ballsInCurrentOver, pendingBatsmanRole, status } = before;
    const snapshot: Snapshot = {
      innings: { runs, wickets, completedOvers, ballsInCurrentOver, pendingBatsmanRole, status },
      match: { status: before.match.status, currentInnings: before.match.currentInnings, firstInningsRuns: before.match.firstInningsRuns, firstInningsWickets: before.match.firstInningsWickets, target: before.match.target, winner: before.match.winner, result: before.match.result },
      players: before.players, sequence: before.ballEvents[0]?.sequence ?? 0,
    };
    await work(tx);
    if (kind === 'NEW_BATSMAN' || kind === 'CHANGE_BOWLER') await linkRosterPlayers(tx, id);
    await tx.matchAction.create({ data: {
      matchId: before.matchId, inningsId: id, requestId, fingerprint, kind,
      revision: before.match.revision + 1,
      ...(kind === 'UNDO' ? {} : { snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue }),
    } });
    return readScoreboard(tx, id);
  });
}

export function undoAction(id: string, command: Command = {}) {
  return applyAction(id, 'UNDO', null, command, async tx => {
    const innings = await tx.innings.findUniqueOrThrow({ where: { id } });
    const action = await tx.matchAction.findFirst({ where: { matchId: innings.matchId, kind: { not: 'UNDO' }, undoneAt: null }, orderBy: { revision: 'desc' } });
    if (!action?.snapshot || action.inningsId !== id) throw new ActionConflict('There is no action to undo in this innings.');
    const snapshot = action.snapshot as unknown as Snapshot;
    await tx.ballEvent.deleteMany({ where: { inningsId: id, sequence: { gt: snapshot.sequence } } });
    await tx.playerInnings.deleteMany({ where: { inningsId: id, id: { notIn: snapshot.players.map(player => player.id) } } });
    for (const player of snapshot.players) {
      const { id: playerId, inningsId: _inningsId, ...data } = player;
      await tx.playerInnings.update({ where: { id: playerId }, data });
    }
    await tx.innings.update({ where: { id }, data: snapshot.innings });
    await tx.match.update({ where: { id: innings.matchId }, data: snapshot.match });
    await tx.matchAction.update({ where: { id: action.id }, data: { undoneAt: new Date() } });
  });
}
