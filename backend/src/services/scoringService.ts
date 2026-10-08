import { prisma } from './database.js';
import { serializableTransaction } from './transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ScoredRuns } from '../utils/validateScore.js';
import type { ExtraEventType } from '../utils/validateExtra.js';
import type { SecondInningsSetup } from '../utils/validateSecondInnings.js';
import { calculateResult } from '../utils/calculateResult.js';

const eventTypes = { 0: 'DOT', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 6: 'SIX' } as const;

export class InningsNotFoundError extends Error {}
export class InningsNotScoringError extends Error {}
export class ActivePlayerMissingError extends Error {}
export class BowlerChangeRequiredError extends Error {}
export class BowlerChangeNotAllowedError extends Error {}
export class NewBatsmanNotExpectedError extends Error {}
export class BatsmanReplacementRequiredError extends Error {}
export class MatchSetupStateError extends Error {}

const inningsWithScoreboard = {
  players: { orderBy: { id: 'asc' as const } },
  ballEvents: { orderBy: { sequence: 'desc' as const }, take: 12 },
  match: { select: { id: true, team1Name: true, team2Name: true, oversLimit: true, currentInnings: true, status: true, firstInningsRuns: true, firstInningsWickets: true, target: true, winner: true, result: true } },
};

async function finishFirstInnings(transaction: Prisma.TransactionClient, matchId: string, runs: number, wickets: number) {
  await transaction.innings.updateMany({ where: { matchId, inningsNumber: 1 }, data: { status: 'COMPLETED', pendingBatsmanRole: null } });
  await transaction.match.update({
    where: { id: matchId },
    data: { firstInningsRuns: runs, firstInningsWickets: wickets, target: runs + 1 },
  });
}

async function finishMatchInTransaction(
  transaction: Prisma.TransactionClient,
  inningsId: string,
  runs: number,
  wickets: number,
  battingTeamName: string,
  firstInningsRuns: number,
  firstInningsTeamName: string,
) {
  const { winner, result } = calculateResult({
    battingFirstTeam: firstInningsTeamName,
    battingSecondTeam: battingTeamName,
    firstInningsRuns,
    secondInningsRuns: runs,
    secondInningsWickets: wickets,
  });
  await transaction.innings.update({ where: { id: inningsId }, data: { status: 'COMPLETED', pendingBatsmanRole: null } });
  const innings = await transaction.innings.findUniqueOrThrow({ where: { id: inningsId } });
  await transaction.match.update({ where: { id: innings.matchId }, data: { status: 'COMPLETED', winner, result } });
}

export function getInnings(inningsId: string) {
  return prisma.innings.findUnique({ where: { id: inningsId }, include: inningsWithScoreboard });
}

export async function recordScore(inningsId: string, runs: ScoredRuns) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: { players: true, ballEvents: { orderBy: { sequence: 'desc' }, take: 1 }, match: true },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();

    const striker = innings.players.find(player => player.activeRole === 'STRIKER');
    const nonStriker = innings.players.find(player => player.activeRole === 'NON_STRIKER');
    const bowler = innings.players.find(player => player.activeRole === 'BOWLER');
    if (!bowler && innings.completedOvers > 0 && innings.ballsInCurrentOver === 0) throw new BowlerChangeRequiredError();
    if (!striker || !nonStriker || !bowler) throw new ActivePlayerMissingError();

    const sequence = (innings.ballEvents[0]?.sequence ?? 0) + 1;
    const overCompleted = innings.ballsInCurrentOver === 5;
    if (overCompleted) {
      await transaction.innings.update({
        where: { id: inningsId },
        data: { runs: { increment: runs }, completedOvers: { increment: 1 }, ballsInCurrentOver: 0 },
      });
    } else {
      await transaction.innings.update({
        where: { id: inningsId },
        data: { runs: { increment: runs }, ballsInCurrentOver: { increment: 1 } },
      });
    }
    await transaction.playerInnings.update({
      where: { id: striker.id },
      data: { runs: { increment: runs }, ballsFaced: { increment: 1 } },
    });
    await transaction.playerInnings.update({
      where: { id: bowler.id },
      data: { runsConceded: { increment: runs }, ballsBowled: { increment: 1 } },
    });
    await transaction.ballEvent.create({
      data: {
        inningsId,
        sequence,
        overNumber: innings.completedOvers + 1,
        ballNumber: innings.ballsInCurrentOver + 1,
        batsmanName: striker.playerName,
        bowlerName: bowler.playerName,
        runs,
        eventType: eventTypes[runs],
      },
    });

    // An odd-run rotation and the end-of-over rotation each change ends once.
    const runRotation = runs === 1 || runs === 3;
    if (runRotation !== overCompleted) {
      await transaction.playerInnings.update({ where: { id: striker.id }, data: { activeRole: 'NON_STRIKER' } });
      await transaction.playerInnings.update({ where: { id: nonStriker.id }, data: { activeRole: 'STRIKER' } });
    }
    if (overCompleted) {
      await transaction.playerInnings.update({ where: { id: bowler.id }, data: { activeRole: null } });
    }
    const nextOvers = innings.completedOvers + Number(overCompleted);
    const nextRuns = innings.runs + runs;
    if (innings.inningsNumber === 1 && nextOvers >= innings.match.oversLimit) {
      await finishFirstInnings(transaction, innings.matchId, nextRuns, innings.wickets);
    } else if (innings.inningsNumber === 2 && (nextRuns >= (innings.match.target ?? Number.MAX_SAFE_INTEGER) || nextOvers >= innings.match.oversLimit)) {
      await finishMatchInTransaction(transaction, inningsId, nextRuns, innings.wickets, innings.battingTeamName, innings.match.firstInningsRuns ?? 0, innings.bowlingTeamName);
    }
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}

export async function recordWicket(inningsId: string) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: { players: true, ballEvents: { orderBy: { sequence: 'desc' }, take: 1 }, match: true },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();
    const striker = innings.players.find(player => player.activeRole === 'STRIKER');
    const nonStriker = innings.players.find(player => player.activeRole === 'NON_STRIKER');
    const bowler = innings.players.find(player => player.activeRole === 'BOWLER');
    if (!bowler && innings.completedOvers > 0 && innings.ballsInCurrentOver === 0) throw new BowlerChangeRequiredError();
    if (!striker || !nonStriker || !bowler) throw new ActivePlayerMissingError();

    const sequence = (innings.ballEvents[0]?.sequence ?? 0) + 1;
    const overCompleted = innings.ballsInCurrentOver === 5;
    await transaction.innings.update({
      where: { id: inningsId },
      data: overCompleted
        ? { wickets: { increment: 1 }, completedOvers: { increment: 1 }, ballsInCurrentOver: 0, pendingBatsmanRole: 'NON_STRIKER' }
        : { wickets: { increment: 1 }, ballsInCurrentOver: { increment: 1 }, pendingBatsmanRole: 'STRIKER' },
    });
    await transaction.playerInnings.update({
      where: { id: striker.id },
      data: { isOut: true, activeRole: null, ballsFaced: { increment: 1 } },
    });
    await transaction.playerInnings.update({
      where: { id: bowler.id },
      data: { wicketsTaken: { increment: 1 }, ballsBowled: { increment: 1 } },
    });
    await transaction.ballEvent.create({
      data: {
        inningsId,
        sequence,
        overNumber: innings.completedOvers + 1,
        ballNumber: innings.ballsInCurrentOver + 1,
        batsmanName: striker.playerName,
        bowlerName: bowler.playerName,
        runs: 0,
        eventType: 'WICKET',
      },
    });
    if (overCompleted) {
      await transaction.playerInnings.update({ where: { id: nonStriker.id }, data: { activeRole: 'STRIKER' } });
      await transaction.playerInnings.update({ where: { id: bowler.id }, data: { activeRole: null } });
    }
    const nextOvers = innings.completedOvers + Number(overCompleted);
    const nextWickets = innings.wickets + 1;
    if (innings.inningsNumber === 1 && (nextOvers >= innings.match.oversLimit || nextWickets >= 10)) {
      await finishFirstInnings(transaction, innings.matchId, innings.runs, nextWickets);
    } else if (innings.inningsNumber === 2 && (nextOvers >= innings.match.oversLimit || nextWickets >= 10)) {
      await finishMatchInTransaction(transaction, inningsId, innings.runs, nextWickets, innings.battingTeamName, innings.match.firstInningsRuns ?? 0, innings.bowlingTeamName);
    }
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}

export async function addNewBatsman(inningsId: string, playerName: string) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({ where: { id: inningsId } });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();
    if (!innings.pendingBatsmanRole) throw new NewBatsmanNotExpectedError();
    await transaction.playerInnings.create({
      data: { inningsId, playerName, playerType: 'BATSMAN', activeRole: innings.pendingBatsmanRole },
    });
    await transaction.innings.update({ where: { id: inningsId }, data: { pendingBatsmanRole: null } });
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}

export async function recordExtra(inningsId: string, eventType: ExtraEventType) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: { players: true, ballEvents: { orderBy: { sequence: 'desc' }, take: 1 }, match: true },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();
    if (innings.pendingBatsmanRole) throw new BatsmanReplacementRequiredError();
    const bowler = innings.players.find(player => player.activeRole === 'BOWLER');
    const striker = innings.players.find(player => player.activeRole === 'STRIKER');
    if (!bowler && innings.completedOvers > 0 && innings.ballsInCurrentOver === 0) throw new BowlerChangeRequiredError();
    if (!bowler || !striker) throw new ActivePlayerMissingError();

    await transaction.innings.update({ where: { id: inningsId }, data: { runs: { increment: 1 } } });
    await transaction.playerInnings.update({ where: { id: bowler.id }, data: { runsConceded: { increment: 1 } } });
    await transaction.ballEvent.create({
      data: {
        inningsId,
        sequence: (innings.ballEvents[0]?.sequence ?? 0) + 1,
        overNumber: innings.completedOvers + 1,
        ballNumber: innings.ballsInCurrentOver + 1,
        batsmanName: striker.playerName,
        bowlerName: bowler.playerName,
        runs: 1,
        eventType,
      },
    });
    const nextRuns = innings.runs + 1;
    if (innings.inningsNumber === 2 && nextRuns >= (innings.match.target ?? Number.MAX_SAFE_INTEGER)) {
      await finishMatchInTransaction(transaction, inningsId, nextRuns, innings.wickets, innings.battingTeamName, innings.match.firstInningsRuns ?? 0, innings.bowlingTeamName);
    }
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}

export async function endInnings(inningsId: string) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({ where: { id: inningsId }, include: { match: true } });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();
    await transaction.innings.update({
      where: { id: inningsId },
      data: { status: 'COMPLETED', pendingBatsmanRole: null },
    });
    if (innings.inningsNumber === 1) {
      await transaction.match.update({
        where: { id: innings.matchId },
        data: { firstInningsRuns: innings.runs, firstInningsWickets: innings.wickets, target: innings.runs + 1 },
      });
    } else {
      await finishMatchInTransaction(transaction, inningsId, innings.runs, innings.wickets, innings.battingTeamName, innings.match.firstInningsRuns ?? 0, innings.bowlingTeamName);
    }
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}

export async function finishMatch(matchId: string) {
  return serializableTransaction(async transaction => {
    const match = await transaction.match.findUnique({ where: { id: matchId }, include: { innings: true } });
    if (!match) throw new InningsNotFoundError();
    const secondInnings = match.innings.find(innings => innings.inningsNumber === 2);
    if (!secondInnings) throw new MatchSetupStateError();
    await finishMatchInTransaction(transaction, secondInnings.id, secondInnings.runs, secondInnings.wickets, secondInnings.battingTeamName, match.firstInningsRuns ?? 0, secondInnings.bowlingTeamName);
    return transaction.match.findUniqueOrThrow({ where: { id: matchId }, include: { innings: { include: { players: true, ballEvents: true } } } });
  });
}

export async function startSecondInnings(matchId: string, setup: SecondInningsSetup) {
  return serializableTransaction(async transaction => {
    const match = await transaction.match.findUnique({ where: { id: matchId }, include: { innings: true } });
    if (!match) throw new InningsNotFoundError();
    const firstInnings = match.innings.find(innings => innings.inningsNumber === 1);
    if (!firstInnings || firstInnings.status !== 'COMPLETED' || match.currentInnings !== 1 || match.status !== 'IN_PROGRESS') {
      throw new MatchSetupStateError();
    }
    const secondInnings = await transaction.innings.create({
      data: {
        matchId,
        inningsNumber: 2,
        battingTeamName: firstInnings.bowlingTeamName,
        bowlingTeamName: firstInnings.battingTeamName,
        players: {
          create: [
            { playerName: setup.strikerName, playerType: 'BATSMAN', activeRole: 'STRIKER' },
            { playerName: setup.nonStrikerName, playerType: 'BATSMAN', activeRole: 'NON_STRIKER' },
            { playerName: setup.bowlerName, playerType: 'BOWLER', activeRole: 'BOWLER' },
          ],
        },
      },
    });
    await transaction.match.update({ where: { id: matchId }, data: { currentInnings: 2 } });
    return transaction.innings.findUniqueOrThrow({ where: { id: secondInnings.id }, include: inningsWithScoreboard });
  });
}

export async function changeBowler(inningsId: string, playerName: string) {
  return serializableTransaction(async transaction => {
    const innings = await transaction.innings.findUnique({ where: { id: inningsId }, include: { players: true } });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== 'IN_PROGRESS') throw new InningsNotScoringError();
    if (innings.completedOvers === 0 || innings.ballsInCurrentOver !== 0) throw new BowlerChangeNotAllowedError();

    const oldBowler = innings.players.find(player => player.activeRole === 'BOWLER');
    const nextBowler = innings.players.find(player => player.playerType === 'BOWLER' && player.playerName.toLowerCase() === playerName.toLowerCase());
    if (oldBowler && oldBowler.id !== nextBowler?.id) {
      await transaction.playerInnings.update({ where: { id: oldBowler.id }, data: { activeRole: null } });
    }
    if (nextBowler) {
      await transaction.playerInnings.update({ where: { id: nextBowler.id }, data: { activeRole: 'BOWLER' } });
    } else {
      await transaction.playerInnings.create({
        data: { inningsId, playerName, playerType: 'BOWLER', activeRole: 'BOWLER' },
      });
    }
    return transaction.innings.findUniqueOrThrow({ where: { id: inningsId }, include: inningsWithScoreboard });
  });
}
