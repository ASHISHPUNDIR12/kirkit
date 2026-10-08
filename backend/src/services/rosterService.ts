import { prisma } from './database.js';
import type { Prisma } from '../generated/prisma/client.js';

export class RosterError extends Error {}
export function rosterName(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) throw new RosterError('Names must contain 1–60 characters.');
  return value.trim();
}
export async function listTeams(ownerId: string) {
  const teams = await prisma.team.findMany({ where: { ownerId }, orderBy: { name: 'asc' }, include: { players: { orderBy: { name: 'asc' }, include: { innings: { include: { innings: { select: { matchId: true } } } } } } } });
  return teams.map(team => ({ id: team.id, name: team.name, players: team.players.map(({ innings, ...player }) => {
    const batting = innings.filter(i => i.playerType === 'BATSMAN');
    const bowling = innings.filter(i => i.playerType === 'BOWLER');
    const sum = (rows: typeof innings, key: 'runs' | 'ballsFaced' | 'runsConceded' | 'ballsBowled' | 'wicketsTaken') => rows.reduce((n, i) => n + i[key], 0);
    const runs = sum(batting, 'runs'), ballsFaced = sum(batting, 'ballsFaced'), ballsBowled = sum(bowling, 'ballsBowled'), runsConceded = sum(bowling, 'runsConceded');
    const dismissals = batting.filter(i => i.isOut).length;
    return { id: player.id, name: player.name, stats: {
      matches: new Set(innings.map(i => i.innings.matchId)).size, runs, ballsFaced, wickets: sum(bowling, 'wicketsTaken'), runsConceded, ballsBowled,
      strikeRate: ballsFaced ? Number((runs * 100 / ballsFaced).toFixed(2)) : null,
      economy: ballsBowled ? Number((runsConceded * 6 / ballsBowled).toFixed(2)) : null,
      average: dismissals ? Number((runs / dismissals).toFixed(2)) : null,
    } };
  }) }));
}
export function createTeam(ownerId: string, value: unknown) {
  const name = rosterName(value);
  return prisma.team.create({ data: { ownerId, name, nameKey: name.toLowerCase() }, include: { players: true } });
}
export async function addPlayer(ownerId: string, teamId: string, value: unknown) {
  const name = rosterName(value);
  const team = await prisma.team.findFirst({ where: { id: teamId, ownerId } });
  if (!team) throw new RosterError('Team not found.');
  return prisma.player.create({ data: { teamId, name, nameKey: name.toLowerCase() } });
}
export async function linkRosterPlayers(tx: Prisma.TransactionClient, inningsId: string) {
  const innings = await tx.innings.findUniqueOrThrow({ where: { id: inningsId }, include: { match: true, players: true } });
  const firstBatting = innings.battingTeamName === innings.match.team1Name;
  for (const player of innings.players.filter(p => !p.playerId)) {
    const fromFirstTeam = player.playerType === 'BATSMAN' ? firstBatting : !firstBatting;
    const teamId = fromFirstTeam ? innings.match.team1Id : innings.match.team2Id;
    if (!teamId) continue;
    const saved = await tx.player.findUnique({ where: { teamId_nameKey: { teamId, nameKey: player.playerName.toLowerCase() } } });
    if (saved) await tx.playerInnings.update({ where: { id: player.id }, data: { playerId: saved.id } });
  }
}
