import { linkRosterPlayers, RosterError } from './rosterService.js';
import { calculateScorecard } from '../utils/scorecard.js';
import { prisma } from "./database.js";
import { serializableTransaction } from "./transaction.js";
import type { CreateMatchInput } from "../utils/validateMatch.js";
import type { StartMatchInput } from "../utils/validateMatch.js";

export async function createMatch(data: CreateMatchInput, ownerId: string) {
  for (const [id, name] of [[data.team1Id, data.team1Name], [data.team2Id, data.team2Name]]) {
    if (!id) continue;
    const team = await prisma.team.findFirst({ where: { id, ownerId } });
    if (!team || team.name !== name) throw new RosterError('Choose one of your saved teams, or enter a custom team name.');
  }
  if (data.team1Id && data.team1Id === data.team2Id) throw new RosterError('Choose two different teams.');
  return prisma.match.create({ data: { ...data, ownerId } });
}

export function listMatches(ownerId: string) {
  return prisma.match.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function getMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      innings: {
        orderBy: { inningsNumber: "asc" },
        include: {
          players: { orderBy: { id: "asc" } },
          ballEvents: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  return match ? { ...match, innings: match.innings.map(innings => ({ ...innings, scorecard: calculateScorecard(innings) })) } : null;
}

export class MatchNotFoundError extends Error {}
export class MatchAlreadyStartedError extends Error {}
export class InvalidBattingFirstTeamError extends Error {}

export async function startMatch(matchId: string, setup: StartMatchInput) {
  return serializableTransaction(async (transaction) => {
    const match = await transaction.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new MatchNotFoundError();
    if (match.status !== "CREATED") throw new MatchAlreadyStartedError();
    if (
      setup.battingFirstTeam !== match.team1Name &&
      setup.battingFirstTeam !== match.team2Name
    ) {
      throw new InvalidBattingFirstTeamError();
    }
    const bowlingTeamName =
      setup.battingFirstTeam === match.team1Name
        ? match.team2Name
        : match.team1Name;
    const started = await transaction.match.update({
      where: { id: matchId },
      data: {
        revision: { increment: 1 },
        battingFirstTeam: setup.battingFirstTeam,
        currentInnings: 1,
        status: "IN_PROGRESS",
        innings: {
          create: {
            inningsNumber: 1,
            battingTeamName: setup.battingFirstTeam,
            bowlingTeamName,
            players: {
              create: [
                {
                  playerName: setup.strikerName,
                  playerType: "BATSMAN",
                  activeRole: "STRIKER",
                },
                {
                  playerName: setup.nonStrikerName,
                  playerType: "BATSMAN",
                  activeRole: "NON_STRIKER",
                },
                {
                  playerName: setup.bowlerName,
                  playerType: "BOWLER",
                  activeRole: "BOWLER",
                },
              ],
            },
          },
        },
      },
      include: { innings: { include: { players: true } } },
    });
    await linkRosterPlayers(transaction, started.innings[0].id);
    return started;
  });
}
