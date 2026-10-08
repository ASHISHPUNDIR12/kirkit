import type { Prisma } from '../generated/prisma/client.js';

export const scoreboardInclude = {
  players: { orderBy: { id: 'asc' as const } },
  ballEvents: { orderBy: { sequence: 'desc' as const }, take: 12 },
  match: { select: {
    id: true, revision: true, team1Id: true, team2Id: true,
    team1Name: true, team2Name: true, oversLimit: true, currentInnings: true,
    status: true, firstInningsRuns: true, firstInningsWickets: true, target: true, winner: true, result: true,
  } },
};
export async function readScoreboard(tx: Prisma.TransactionClient, id: string) {
  const innings = await tx.innings.findUniqueOrThrow({ where: { id }, include: scoreboardInclude });
  const last = await tx.matchAction.findFirst({ where: { matchId: innings.matchId, undoneAt: null, kind: { not: 'UNDO' } }, orderBy: { revision: 'desc' }, select: { inningsId: true, kind: true } });
  const canUndo = !!last && last.inningsId === id && innings.match.currentInnings === innings.inningsNumber;
  return { ...innings, canUndo, undoLabel: canUndo ? last.kind.replaceAll('_', ' ').toLowerCase() : null };
}
