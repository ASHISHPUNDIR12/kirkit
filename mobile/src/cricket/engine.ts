import { calculateResult } from './calculateResult.ts';
import type { IdFactory, LocalInnings, LocalPlayer, MatchState, ScoringAction, UndoSnapshot } from './models.ts';
import type { StartMatchInput } from '../types/api.ts';

export function playerName(value: string) {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error('Names must contain 1–60 characters.');
  return name;
}
export function validateOpeners(setup: Omit<StartMatchInput, 'battingFirstTeam'>) {
  const strikerName = playerName(setup.strikerName);
  const nonStrikerName = playerName(setup.nonStrikerName);
  const bowlerName = playerName(setup.bowlerName);
  if (strikerName.toLowerCase() === nonStrikerName.toLowerCase()) throw new Error('Choose two different opening batsmen.');
  return { strikerName, nonStrikerName, bowlerName };
}
export function newPlayer(inningsId: string, name: string, role: NonNullable<LocalPlayer['activeRole']>, id: IdFactory): LocalPlayer {
  return {
    id: id(), inningsId, playerId: null, playerName: playerName(name),
    playerType: role === 'BOWLER' ? 'BOWLER' : 'BATSMAN', activeRole: role,
    runs: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0, wicketsTaken: 0, isOut: false,
  };
}
export function newInnings(state: MatchState, number: 1 | 2, battingTeam: string, setup: Omit<StartMatchInput, 'battingFirstTeam'>, id: IdFactory): LocalInnings {
  const names = validateOpeners(setup);
  const inningsId = id();
  return {
    id: inningsId, matchId: state.match.id, inningsNumber: number, battingTeamName: battingTeam,
    bowlingTeamName: battingTeam === state.match.team1Name ? state.match.team2Name : state.match.team1Name,
    runs: 0, wickets: 0, completedOvers: 0, ballsInCurrentOver: 0,
    pendingBatsmanRole: null, status: 'IN_PROGRESS', ballEvents: [],
    players: [newPlayer(inningsId, names.strikerName, 'STRIKER', id), newPlayer(inningsId, names.nonStrikerName, 'NON_STRIKER', id), newPlayer(inningsId, names.bowlerName, 'BOWLER', id)],
  };
}

function complete(state: MatchState, innings: LocalInnings) {
  innings.status = 'COMPLETED';
  innings.pendingBatsmanRole = null;
  if (innings.inningsNumber === 1) {
    state.match.firstInningsRuns = innings.runs;
    state.match.firstInningsWickets = innings.wickets;
    state.match.target = innings.runs + 1;
  } else {
    const result = calculateResult({
      battingFirstTeam: innings.bowlingTeamName, battingSecondTeam: innings.battingTeamName,
      firstInningsRuns: state.match.firstInningsRuns ?? 0,
      secondInningsRuns: innings.runs, secondInningsWickets: innings.wickets,
    });
    Object.assign(state.match, result, { status: 'COMPLETED' });
  }
}

/** Mutates an in-memory transaction snapshot. No SQL, network, or React dependencies. */
export function applyScoring(state: MatchState, innings: LocalInnings, action: ScoringAction, id: IdFactory, now: string) {
  if (innings.inningsNumber !== state.match.currentInnings) throw new Error('Only the current innings can be changed.');
  if (innings.status !== 'IN_PROGRESS') throw new Error('This innings has finished. Undo its last action to correct it.');
  if (action.kind === 'END_INNINGS') { complete(state, innings); return; }
  if (action.kind === 'NEW_BATSMAN') {
    if (!innings.pendingBatsmanRole) throw new Error('A replacement batsman is not needed.');
    const name = playerName(action.playerName ?? '');
    if (innings.players.some(p => p.playerType === 'BATSMAN' && p.playerName.toLowerCase() === name.toLowerCase())) throw new Error('This batsman has already batted. Choose a different player.');
    innings.players.push(newPlayer(innings.id, name, innings.pendingBatsmanRole, id));
    innings.pendingBatsmanRole = null;
    return;
  }
  if (action.kind === 'CHANGE_BOWLER') {
    if (!innings.completedOvers || innings.ballsInCurrentOver !== 0) throw new Error('Change the bowler at the end of an over.');
    const name = playerName(action.playerName ?? '');
    const existing = innings.players.find(p => p.playerType === 'BOWLER' && p.playerName.toLowerCase() === name.toLowerCase());
    for (const player of innings.players) if (player.activeRole === 'BOWLER') player.activeRole = null;
    if (existing) existing.activeRole = 'BOWLER';
    else innings.players.push(newPlayer(innings.id, name, 'BOWLER', id));
    return;
  }
  const striker = innings.players.find(p => p.activeRole === 'STRIKER');
  const partner = innings.players.find(p => p.activeRole === 'NON_STRIKER');
  const bowler = innings.players.find(p => p.activeRole === 'BOWLER');
  if (innings.pendingBatsmanRole) throw new Error('Add the next batsman before scoring.');
  if (!bowler && innings.completedOvers && !innings.ballsInCurrentOver) throw new Error('Choose the bowler for the next over.');
  if (!striker || !partner || !bowler) throw new Error('Set up the active batsmen and bowler before scoring.');

  const extra = action.kind === 'WIDE' || action.kind === 'NO_BALL';
  const wicket = action.kind === 'WICKET';
  const runs = extra ? 1 : wicket ? 0 : action.runs;
  if (runs === undefined || ![0, 1, 2, 3, 4, 6].includes(runs)) throw new Error('Choose 0, 1, 2, 3, 4, or 6 runs.');
  const types: Record<number, string> = { 0: 'DOT', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 6: 'SIX' };
  innings.ballEvents.push({
    id: id(), inningsId: innings.id, sequence: (innings.ballEvents.at(-1)?.sequence ?? 0) + 1,
    overNumber: innings.completedOvers + 1, ballNumber: innings.ballsInCurrentOver + 1,
    batsmanId: striker.id, batsmanName: striker.playerName, nonStrikerName: partner.playerName,
    bowlerName: bowler.playerName, runs, eventType: extra || wicket ? action.kind : types[runs], createdAt: now,
  });
  innings.runs += runs;
  bowler.runsConceded += runs;
  if (!extra) {
    striker.ballsFaced++;
    bowler.ballsBowled++;
    const overEnded = innings.ballsInCurrentOver === 5;
    innings.ballsInCurrentOver = overEnded ? 0 : innings.ballsInCurrentOver + 1;
    innings.completedOvers += Number(overEnded);
    if (wicket) {
      innings.wickets++; bowler.wicketsTaken++; striker.isOut = true; striker.activeRole = null;
      innings.pendingBatsmanRole = overEnded ? 'NON_STRIKER' : 'STRIKER';
      if (overEnded) partner.activeRole = 'STRIKER';
    } else {
      striker.runs += runs;
      if ((runs === 1 || runs === 3) !== overEnded) {
        striker.activeRole = 'NON_STRIKER'; partner.activeRole = 'STRIKER';
      }
    }
    if (overEnded) bowler.activeRole = null;
  }
  if (innings.completedOvers >= state.match.oversLimit || innings.wickets >= 10 ||
      (innings.inningsNumber === 2 && innings.runs >= (state.match.target ?? Number.MAX_SAFE_INTEGER))) complete(state, innings);
}

export function takeSnapshot(state: MatchState, innings: LocalInnings): UndoSnapshot {
  const { runs, wickets, completedOvers, ballsInCurrentOver, pendingBatsmanRole, status } = innings;
  const match = state.match;
  return JSON.parse(JSON.stringify({
    innings: { runs, wickets, completedOvers, ballsInCurrentOver, pendingBatsmanRole, status },
    match: { status: match.status, currentInnings: match.currentInnings, firstInningsRuns: match.firstInningsRuns,
      firstInningsWickets: match.firstInningsWickets, target: match.target, winner: match.winner, result: match.result },
    players: innings.players, sequence: innings.ballEvents.at(-1)?.sequence ?? 0,
  })) as UndoSnapshot;
}
export function restoreSnapshot(state: MatchState, innings: LocalInnings, snapshot: UndoSnapshot) {
  Object.assign(innings, snapshot.innings);
  Object.assign(state.match, snapshot.match);
  innings.players = snapshot.players;
  innings.ballEvents = innings.ballEvents.filter(event => event.sequence <= snapshot.sequence);
}
