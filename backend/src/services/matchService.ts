import { prisma } from './database.js';
import { serializableTransaction } from './transaction.js';
import type { CreateMatchInput } from '../utils/validateMatch.js';
import type { StartMatchInput } from '../utils/validateMatch.js';

export function createMatch(data: CreateMatchInput, ownerId: string) {
  return prisma.match.create({ data: { ...data, ownerId } });
}

export function listMatches(ownerId: string) {
  return prisma.match.findMany({ where: { ownerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
}

export function getMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      innings: {
        orderBy: { inningsNumber: 'asc' },
        include: {
          players: { orderBy: { id: 'asc' } },
          ballEvents: { orderBy: { sequence: 'asc' } },
        },
      },
    },
  });
}

export class MatchNotFoundError extends Error {}
export class MatchAlreadyStartedError extends Error {}
export class InvalidBattingFirstTeamError extends Error {}

export async function startMatch(matchId: string, setup: StartMatchInput) {
  return serializableTransaction(async transaction => {
    const match = await transaction.match.findUnique({ where: { id: matchId } });
    if (!match) throw new MatchNotFoundError();
    if (match.status !== 'CREATED') throw new MatchAlreadyStartedError();
    if (setup.battingFirstTeam !== match.team1Name && setup.battingFirstTeam !== match.team2Name) {
      throw new InvalidBattingFirstTeamError();
    }
    const bowlingTeamName = setup.battingFirstTeam === match.team1Name ? match.team2Name : match.team1Name;
    const started = await transaction.match.update({
      where: { id: matchId },
      data: {
        battingFirstTeam: setup.battingFirstTeam,
        currentInnings: 1,
        status: 'IN_PROGRESS',
        innings: {
          create: {
            inningsNumber: 1,
            battingTeamName: setup.battingFirstTeam,
            bowlingTeamName,
            players: {
              create: [
                { playerName: setup.strikerName, playerType: 'BATSMAN', activeRole: 'STRIKER' },
                { playerName: setup.nonStrikerName, playerType: 'BATSMAN', activeRole: 'NON_STRIKER' },
                { playerName: setup.bowlerName, playerType: 'BOWLER', activeRole: 'BOWLER' },
              ],
            },
          },
        },
      },
      include: { innings: { include: { players: true } } },
    });
    return started;
  });
}
