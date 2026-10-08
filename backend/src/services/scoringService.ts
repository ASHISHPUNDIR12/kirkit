import { ActionConflict, applyAction, type Command } from './actions.js';
import { scoreboardInclude, readScoreboard } from './scoreboard.js';
import { linkRosterPlayers } from './rosterService.js';
import { prisma } from "./database.js";
import { serializableTransaction } from "./transaction.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { ScoredRuns } from "../utils/validateScore.js";
import type { ExtraEventType } from "../utils/validateExtra.js";
import type { SecondInningsSetup } from "../utils/validateSecondInnings.js";
import { calculateResult } from "../utils/calculateResult.js";

const eventTypes = {
  0: "DOT",
  1: "ONE",
  2: "TWO",
  3: "THREE",
  4: "FOUR",
  6: "SIX",
} as const;

export class InningsNotFoundError extends Error {}
export class InningsNotScoringError extends Error {}
export class ActivePlayerMissingError extends Error {}
export class BowlerChangeRequiredError extends Error {}
export class BowlerChangeNotAllowedError extends Error {}
export class NewBatsmanNotExpectedError extends Error {}
export class BatsmanReplacementRequiredError extends Error {}
export class MatchSetupStateError extends Error {}

const inningsWithScoreboard = scoreboardInclude;

async function finishFirstInnings(
  transaction: Prisma.TransactionClient,
  matchId: string,
  runs: number,
  wickets: number,
) {
  await transaction.innings.updateMany({
    where: { matchId, inningsNumber: 1 },
    data: { status: "COMPLETED", pendingBatsmanRole: null },
  });
  await transaction.match.update({
    where: { id: matchId },
    data: {
      firstInningsRuns: runs,
      firstInningsWickets: wickets,
      target: runs + 1,
    },
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
  await transaction.innings.update({
    where: { id: inningsId },
    data: { status: "COMPLETED", pendingBatsmanRole: null },
  });
  const innings = await transaction.innings.findUniqueOrThrow({
    where: { id: inningsId },
  });
  await transaction.match.update({
    where: { id: innings.matchId },
    data: { status: "COMPLETED", winner, result },
  });
}

export async function getInnings(inningsId: string) {
  const exists = await prisma.innings.findUnique({ where: { id: inningsId }, select: { id: true } });
  return exists ? readScoreboard(prisma, inningsId) : null;
}

async function recordScoreCore(inningsId: string, runs: ScoredRuns) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: {
        players: true,
        ballEvents: { orderBy: { sequence: "desc" }, take: 1 },
        match: true,
      },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();

    const striker = innings.players.find(
      (player) => player.activeRole === "STRIKER",
    );
    const nonStriker = innings.players.find(
      (player) => player.activeRole === "NON_STRIKER",
    );
    const bowler = innings.players.find(
      (player) => player.activeRole === "BOWLER",
    );
    if (
      !bowler &&
      innings.completedOvers > 0 &&
      innings.ballsInCurrentOver === 0
    )
      throw new BowlerChangeRequiredError();
    if (!striker || !nonStriker || !bowler)
      throw new ActivePlayerMissingError();

    const sequence = (innings.ballEvents[0]?.sequence ?? 0) + 1;
    const overCompleted = innings.ballsInCurrentOver === 5;
    if (overCompleted) {
      await transaction.innings.update({
        where: { id: inningsId },
        data: {
          runs: { increment: runs },
          completedOvers: { increment: 1 },
          ballsInCurrentOver: 0,
        },
      });
    } else {
      await transaction.innings.update({
        where: { id: inningsId },
        data: {
          runs: { increment: runs },
          ballsInCurrentOver: { increment: 1 },
        },
      });
    }
    await transaction.playerInnings.update({
      where: { id: striker.id },
      data: { runs: { increment: runs }, ballsFaced: { increment: 1 } },
    });
    await transaction.playerInnings.update({
      where: { id: bowler.id },
      data: {
        runsConceded: { increment: runs },
        ballsBowled: { increment: 1 },
      },
    });
    await transaction.ballEvent.create({
      data: {
        inningsId,
        sequence,
        overNumber: innings.completedOvers + 1,
        ballNumber: innings.ballsInCurrentOver + 1,
        batsmanName: striker.playerName,
        batsmanId: striker.id,
        nonStrikerName: innings.players.find(player => player.activeRole === "NON_STRIKER")?.playerName,
        bowlerName: bowler.playerName,
        runs,
        eventType: eventTypes[runs],
      },
    });

    // An odd-run rotation and the end-of-over rotation each change ends once.
    const runRotation = runs === 1 || runs === 3;
    if (runRotation !== overCompleted) {
      await transaction.playerInnings.update({
        where: { id: striker.id },
        data: { activeRole: "NON_STRIKER" },
      });
      await transaction.playerInnings.update({
        where: { id: nonStriker.id },
        data: { activeRole: "STRIKER" },
      });
    }
    if (overCompleted) {
      await transaction.playerInnings.update({
        where: { id: bowler.id },
        data: { activeRole: null },
      });
    }
    const nextOvers = innings.completedOvers + Number(overCompleted);
    const nextRuns = innings.runs + runs;
    if (innings.inningsNumber === 1 && nextOvers >= innings.match.oversLimit) {
      await finishFirstInnings(
        transaction,
        innings.matchId,
        nextRuns,
        innings.wickets,
      );
    } else if (
      innings.inningsNumber === 2 &&
      (nextRuns >= (innings.match.target ?? Number.MAX_SAFE_INTEGER) ||
        nextOvers >= innings.match.oversLimit)
    ) {
      await finishMatchInTransaction(
        transaction,
        inningsId,
        nextRuns,
        innings.wickets,
        innings.battingTeamName,
        innings.match.firstInningsRuns ?? 0,
        innings.bowlingTeamName,
      );
    }
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

async function recordWicketCore(inningsId: string) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: {
        players: true,
        ballEvents: { orderBy: { sequence: "desc" }, take: 1 },
        match: true,
      },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();
    const striker = innings.players.find(
      (player) => player.activeRole === "STRIKER",
    );
    const nonStriker = innings.players.find(
      (player) => player.activeRole === "NON_STRIKER",
    );
    const bowler = innings.players.find(
      (player) => player.activeRole === "BOWLER",
    );
    if (
      !bowler &&
      innings.completedOvers > 0 &&
      innings.ballsInCurrentOver === 0
    )
      throw new BowlerChangeRequiredError();
    if (!striker || !nonStriker || !bowler)
      throw new ActivePlayerMissingError();

    const sequence = (innings.ballEvents[0]?.sequence ?? 0) + 1;
    const overCompleted = innings.ballsInCurrentOver === 5;
    await transaction.innings.update({
      where: { id: inningsId },
      data: overCompleted
        ? {
            wickets: { increment: 1 },
            completedOvers: { increment: 1 },
            ballsInCurrentOver: 0,
            pendingBatsmanRole: "NON_STRIKER",
          }
        : {
            wickets: { increment: 1 },
            ballsInCurrentOver: { increment: 1 },
            pendingBatsmanRole: "STRIKER",
          },
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
        batsmanId: striker.id,
        nonStrikerName: innings.players.find(player => player.activeRole === "NON_STRIKER")?.playerName,
        bowlerName: bowler.playerName,
        runs: 0,
        eventType: "WICKET",
      },
    });
    if (overCompleted) {
      await transaction.playerInnings.update({
        where: { id: nonStriker.id },
        data: { activeRole: "STRIKER" },
      });
      await transaction.playerInnings.update({
        where: { id: bowler.id },
        data: { activeRole: null },
      });
    }
    const nextOvers = innings.completedOvers + Number(overCompleted);
    const nextWickets = innings.wickets + 1;
    if (
      innings.inningsNumber === 1 &&
      (nextOvers >= innings.match.oversLimit || nextWickets >= 10)
    ) {
      await finishFirstInnings(
        transaction,
        innings.matchId,
        innings.runs,
        nextWickets,
      );
    } else if (
      innings.inningsNumber === 2 &&
      (nextOvers >= innings.match.oversLimit || nextWickets >= 10)
    ) {
      await finishMatchInTransaction(
        transaction,
        inningsId,
        innings.runs,
        nextWickets,
        innings.battingTeamName,
        innings.match.firstInningsRuns ?? 0,
        innings.bowlingTeamName,
      );
    }
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

async function addNewBatsmanCore(inningsId: string, playerName: string) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();
    if (!innings.pendingBatsmanRole) throw new NewBatsmanNotExpectedError();
    const duplicate = await transaction.playerInnings.findFirst({ where: { inningsId, playerType: 'BATSMAN', playerName: { equals: playerName, mode: 'insensitive' } } });
    if (duplicate) throw new ActionConflict('This batsman has already batted. Choose a different player.');
    await transaction.playerInnings.create({
      data: {
        inningsId,
        playerName,
        playerType: "BATSMAN",
        activeRole: innings.pendingBatsmanRole,
      },
    });
    await transaction.innings.update({
      where: { id: inningsId },
      data: { pendingBatsmanRole: null },
    });
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

async function recordExtraCore(
  inningsId: string,
  eventType: ExtraEventType,
) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: {
        players: true,
        ballEvents: { orderBy: { sequence: "desc" }, take: 1 },
        match: true,
      },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();
    if (innings.pendingBatsmanRole) throw new BatsmanReplacementRequiredError();
    const bowler = innings.players.find(
      (player) => player.activeRole === "BOWLER",
    );
    const striker = innings.players.find(
      (player) => player.activeRole === "STRIKER",
    );
    if (
      !bowler &&
      innings.completedOvers > 0 &&
      innings.ballsInCurrentOver === 0
    )
      throw new BowlerChangeRequiredError();
    if (!bowler || !striker) throw new ActivePlayerMissingError();

    await transaction.innings.update({
      where: { id: inningsId },
      data: { runs: { increment: 1 } },
    });
    await transaction.playerInnings.update({
      where: { id: bowler.id },
      data: { runsConceded: { increment: 1 } },
    });
    await transaction.ballEvent.create({
      data: {
        inningsId,
        sequence: (innings.ballEvents[0]?.sequence ?? 0) + 1,
        overNumber: innings.completedOvers + 1,
        ballNumber: innings.ballsInCurrentOver + 1,
        batsmanName: striker.playerName,
        batsmanId: striker.id,
        nonStrikerName: innings.players.find(player => player.activeRole === "NON_STRIKER")?.playerName,
        bowlerName: bowler.playerName,
        runs: 1,
        eventType,
      },
    });
    const nextRuns = innings.runs + 1;
    if (
      innings.inningsNumber === 2 &&
      nextRuns >= (innings.match.target ?? Number.MAX_SAFE_INTEGER)
    ) {
      await finishMatchInTransaction(
        transaction,
        inningsId,
        nextRuns,
        innings.wickets,
        innings.battingTeamName,
        innings.match.firstInningsRuns ?? 0,
        innings.bowlingTeamName,
      );
    }
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

async function endInningsCore(inningsId: string) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: { match: true },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();
    await transaction.innings.update({
      where: { id: inningsId },
      data: { status: "COMPLETED", pendingBatsmanRole: null },
    });
    if (innings.inningsNumber === 1) {
      await transaction.match.update({
        where: { id: innings.matchId },
        data: {
          firstInningsRuns: innings.runs,
          firstInningsWickets: innings.wickets,
          target: innings.runs + 1,
        },
      });
    } else {
      await finishMatchInTransaction(
        transaction,
        inningsId,
        innings.runs,
        innings.wickets,
        innings.battingTeamName,
        innings.match.firstInningsRuns ?? 0,
        innings.bowlingTeamName,
      );
    }
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

export async function finishMatch(matchId: string, command: Command = {}) {
  const innings = await prisma.innings.findUnique({ where: { matchId_inningsNumber: { matchId, inningsNumber: 2 } } });
  if (!innings) throw new MatchSetupStateError();
  await endInnings(innings.id, command);
  return prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: { innings: { include: { players: true, ballEvents: true } } } });
}

export async function startSecondInnings(
  matchId: string,
  setup: SecondInningsSetup,
) {
  return serializableTransaction(async (transaction) => {
    const match = await transaction.match.findUnique({
      where: { id: matchId },
      include: { innings: true },
    });
    if (!match) throw new InningsNotFoundError();
    const firstInnings = match.innings.find(
      (innings) => innings.inningsNumber === 1,
    );
    if (
      !firstInnings ||
      firstInnings.status !== "COMPLETED" ||
      match.currentInnings !== 1 ||
      match.status !== "IN_PROGRESS"
    ) {
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
    });
    await transaction.match.update({
      where: { id: matchId },
      data: { currentInnings: 2, revision: { increment: 1 } },
    });
    await linkRosterPlayers(transaction, secondInnings.id);
    return readScoreboard(transaction, secondInnings.id);
  });
}

async function changeBowlerCore(inningsId: string, playerName: string) {
  return serializableTransaction(async (transaction) => {
    const innings = await transaction.innings.findUnique({
      where: { id: inningsId },
      include: { players: true },
    });
    if (!innings) throw new InningsNotFoundError();
    if (innings.status !== "IN_PROGRESS") throw new InningsNotScoringError();
    if (innings.completedOvers === 0 || innings.ballsInCurrentOver !== 0)
      throw new BowlerChangeNotAllowedError();

    const oldBowler = innings.players.find(
      (player) => player.activeRole === "BOWLER",
    );
    const nextBowler = innings.players.find(
      (player) =>
        player.playerType === "BOWLER" &&
        player.playerName.toLowerCase() === playerName.toLowerCase(),
    );
    if (oldBowler && oldBowler.id !== nextBowler?.id) {
      await transaction.playerInnings.update({
        where: { id: oldBowler.id },
        data: { activeRole: null },
      });
    }
    if (nextBowler) {
      await transaction.playerInnings.update({
        where: { id: nextBowler.id },
        data: { activeRole: "BOWLER" },
      });
    } else {
      await transaction.playerInnings.create({
        data: {
          inningsId,
          playerName,
          playerType: "BOWLER",
          activeRole: "BOWLER",
        },
      });
    }
    return transaction.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: inningsWithScoreboard,
    });
  });
}

export const recordScore = (id: string, runs: ScoredRuns, command: Command = {}) => applyAction(id, 'SCORE', runs, command, () => recordScoreCore(id, runs));
export const recordWicket = (id: string, command: Command = {}) => applyAction(id, 'WICKET', null, command, () => recordWicketCore(id));
export const recordExtra = (id: string, type: ExtraEventType, command: Command = {}) => applyAction(id, type, null, command, () => recordExtraCore(id, type));
export const changeBowler = (id: string, name: string, command: Command = {}) => applyAction(id, 'CHANGE_BOWLER', name, command, () => changeBowlerCore(id, name));
export const addNewBatsman = (id: string, name: string, command: Command = {}) => applyAction(id, 'NEW_BATSMAN', name, command, () => addNewBatsmanCore(id, name));
export const endInnings = (id: string, command: Command = {}) => applyAction(id, 'END_INNINGS', null, command, () => endInningsCore(id));
