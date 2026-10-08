import type { SqlConnection, SqlValue } from './types.ts';
import type { LocalMatch, LocalInnings, LocalPlayer, LocalBall, MatchState } from '../cricket/models.ts';

const columns = {
  matches: ['id','team1Id','team2Id','team1Name','team2Name','oversLimit','battingFirstTeam','tossWinner','tossDecision','currentInnings','status','firstInningsRuns','firstInningsWickets','target','winner','result','revision','createdAt','updatedAt'],
  innings: ['id','matchId','inningsNumber','battingTeamName','bowlingTeamName','runs','wickets','completedOvers','ballsInCurrentOver','pendingBatsmanRole','status'],
  player_innings: ['id','inningsId','playerId','playerName','playerType','activeRole','runs','ballsFaced','runsConceded','ballsBowled','wicketsTaken','isOut'],
  ball_events: ['id','inningsId','sequence','overNumber','ballNumber','batsmanId','batsmanName','nonStrikerName','bowlerName','runs','eventType','createdAt'],
  match_actions: ['id','matchId','inningsId','requestId','fingerprint','kind','revision','snapshot','undoneAt','createdAt'],
} as const;

/** Table/column identifiers come only from the fixed allowlist, never user input. */
export async function put(tx: SqlConnection, table: keyof typeof columns, record: object) {
  const keys = columns[table];
  const row = record as Record<string, unknown>;
  const values = keys.map(key => typeof row[key] === 'boolean' ? Number(row[key]) : row[key] ?? null) as SqlValue[];
  await tx.runAsync(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})
    ON CONFLICT(id) DO UPDATE SET ${keys.filter(k => k !== 'id').map(k => `${k}=excluded.${k}`).join(',')}`, ...values);
}

export async function loadMatch(tx: SqlConnection, id: string): Promise<MatchState> {
  const match = await tx.getFirstAsync<LocalMatch>('SELECT * FROM matches WHERE id=?', id);
  if (!match) throw new Error('Match not found on this device.');
  const innings = await tx.getAllAsync<LocalInnings>('SELECT * FROM innings WHERE matchId=? ORDER BY inningsNumber', id);
  for (const inning of innings) {
    const players = await tx.getAllAsync<Omit<LocalPlayer, 'isOut'> & { isOut: number }>('SELECT * FROM player_innings WHERE inningsId=? ORDER BY rowid', inning.id);
    inning.players = players.map(p => ({ ...p, isOut: Boolean(p.isOut) }));
    inning.ballEvents = await tx.getAllAsync<LocalBall>('SELECT * FROM ball_events WHERE inningsId=? ORDER BY sequence', inning.id);
  }
  return { match, innings };
}

export async function saveMatch(tx: SqlConnection, state: MatchState) {
  await put(tx, 'matches', state.match);
  for (const innings of state.innings) {
    await put(tx, 'innings', innings);
    // Undo removes newly-added players and deliveries. Keep historical action receipts.
    await tx.runAsync('DELETE FROM ball_events WHERE inningsId=? AND sequence>?', innings.id, innings.ballEvents.at(-1)?.sequence ?? 0);
    const ids = innings.players.map(p => p.id);
    if (ids.length) await tx.runAsync(`DELETE FROM player_innings WHERE inningsId=? AND id NOT IN (${ids.map(() => '?').join(',')})`, innings.id, ...ids);
    for (const player of innings.players) await put(tx, 'player_innings', player);
    const last = await tx.getFirstAsync<{ sequence: number }>('SELECT MAX(sequence) AS sequence FROM ball_events WHERE inningsId=?', innings.id);
    for (const event of innings.ballEvents.filter(event => event.sequence > (last?.sequence ?? 0))) await put(tx, 'ball_events', event);
  }
}

export async function linkPlayers(tx: SqlConnection, state: MatchState, innings: LocalInnings) {
  const battingFirst = innings.battingTeamName === state.match.team1Name;
  for (const player of innings.players.filter(p => !p.playerId)) {
    const firstSide = player.playerType === 'BATSMAN' ? battingFirst : !battingFirst;
    const teamId = firstSide ? state.match.team1Id : state.match.team2Id;
    if (!teamId) continue;
    player.playerId = (await tx.getFirstAsync<{ id: string }>('SELECT id FROM players WHERE teamId=? AND nameKey=?', teamId, player.playerName.toLowerCase()))?.id ?? null;
  }
}
