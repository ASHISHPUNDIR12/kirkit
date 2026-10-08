import type { LocalDatabase, SqlConnection } from '../database/types.ts';
import { linkPlayers, loadMatch, put, saveMatch } from '../database/store.ts';
import { applyScoring, newInnings, playerName, restoreSnapshot, takeSnapshot } from './engine.ts';
import { calculateScorecard } from './scorecard.ts';
import type { Command, IdFactory, LocalInnings, LocalMatch, LocalPlayer, ScoringAction, StoredAction, UndoSnapshot } from './models.ts';
import type { CreateMatchInput, MatchDetails, ScoreboardInnings, StartMatchInput, Team } from '../types/api.ts';

export function createCricketRepository(db: LocalDatabase, id: IdFactory, clock = () => new Date().toISOString()) {
  async function stateForInnings(tx: SqlConnection, inningsId: string) {
    const row = await tx.getFirstAsync<{ matchId: string }>('SELECT matchId FROM innings WHERE id=?', inningsId);
    if (!row) throw new Error('Innings not found on this device.');
    const state = await loadMatch(tx, row.matchId);
    return { state, innings: state.innings.find(i => i.id === inningsId)! };
  }
  async function scoreboard(tx: SqlConnection, inningsId: string): Promise<ScoreboardInnings> {
    const { state, innings } = await stateForInnings(tx, inningsId);
    const last = await tx.getFirstAsync<StoredAction>("SELECT * FROM match_actions WHERE matchId=? AND kind!='UNDO' AND undoneAt IS NULL ORDER BY revision DESC LIMIT 1", state.match.id);
    const canUndo = !!last?.snapshot && last.inningsId === inningsId && state.match.currentInnings === innings.inningsNumber;
    return { ...innings, ballEvents: innings.ballEvents.slice(-12).reverse(), match: state.match, canUndo, undoLabel: canUndo ? last!.kind.replaceAll('_', ' ').toLowerCase() : null };
  }
  async function perform(inningsId: string, action: ScoringAction | { kind: 'UNDO' }, command: Command) {
    return db.transaction(async tx => {
      const { state, innings } = await stateForInnings(tx, inningsId);
      const fingerprint = JSON.stringify({ inningsId, action });
      const previous = await tx.getFirstAsync<StoredAction>('SELECT * FROM match_actions WHERE matchId=? AND requestId=?', state.match.id, command.requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error('This action ID was already used for a different score.');
        return scoreboard(tx, inningsId);
      }
      if (command.revision !== undefined && command.revision !== state.match.revision) throw new Error('The score has changed. Refresh the scoreboard before scoring again.');
      if (state.match.currentInnings !== innings.inningsNumber) throw new Error('Only the current innings can be changed.');
      const snapshot = takeSnapshot(state, innings);
      const now = clock();
      if (action.kind === 'UNDO') {
        const last = await tx.getFirstAsync<StoredAction>("SELECT * FROM match_actions WHERE matchId=? AND kind!='UNDO' AND undoneAt IS NULL ORDER BY revision DESC LIMIT 1", state.match.id);
        if (!last?.snapshot || last.inningsId !== inningsId) throw new Error('There is no action to undo in this innings.');
        restoreSnapshot(state, innings, JSON.parse(last.snapshot) as UndoSnapshot);
        await tx.runAsync('UPDATE match_actions SET undoneAt=? WHERE id=?', now, last.id);
      } else {
        applyScoring(state, innings, action, id, now);
        if (action.kind === 'NEW_BATSMAN' || action.kind === 'CHANGE_BOWLER') await linkPlayers(tx, state, innings);
      }
      state.match.revision++;
      state.match.updatedAt = now;
      await saveMatch(tx, state);
      await put(tx, 'match_actions', {
        id: id(), matchId: state.match.id, inningsId, requestId: command.requestId, fingerprint,
        kind: action.kind, revision: state.match.revision, snapshot: action.kind === 'UNDO' ? null : JSON.stringify(snapshot), undoneAt: null, createdAt: now,
      });
      return scoreboard(tx, inningsId);
    });
  }
  const repository = {
    getMatches: () => db.transaction(tx => tx.getAllAsync<LocalMatch>('SELECT * FROM matches ORDER BY createdAt DESC, id DESC')),
    getMatch: (matchId: string): Promise<MatchDetails> => db.transaction(async tx => {
      const state = await loadMatch(tx, matchId);
      return { ...state.match, innings: state.innings.map(innings => ({ ...innings, scorecard: calculateScorecard(innings) })) };
    }),
    getInnings: (inningsId: string) => db.transaction(tx => scoreboard(tx, inningsId)),
    createMatch: (input: CreateMatchInput) => db.transaction(async tx => {
      const team1Name = playerName(input.team1Name), team2Name = playerName(input.team2Name);
      if (team1Name.toLowerCase() === team2Name.toLowerCase()) throw new Error('Choose two different teams.');
      if (!Number.isInteger(input.oversLimit) || input.oversLimit < 1 || input.oversLimit > 2147483647) throw new Error('Enter a positive whole number of overs.');
      for (const [teamId, name] of [[input.team1Id, team1Name], [input.team2Id, team2Name]]) {
        if (!teamId) continue;
        const team = await tx.getFirstAsync<{ name: string }>('SELECT name FROM teams WHERE id=?', teamId);
        if (!team || team.name !== name) throw new Error('Choose a saved team from this account, or enter a custom team.');
      }
      const now = clock();
      const match: LocalMatch = {
        id: id(), team1Id: input.team1Id ?? null, team2Id: input.team2Id ?? null, team1Name, team2Name,
        oversLimit: input.oversLimit, battingFirstTeam: null, tossWinner: null, tossDecision: null,
        currentInnings: 1, status: 'CREATED', firstInningsRuns: null, firstInningsWickets: null,
        target: null, winner: null, result: null, revision: 0, createdAt: now, updatedAt: now,
      };
      await put(tx, 'matches', match);
      return match;
    }),
    startMatch: (matchId: string, setup: StartMatchInput) => db.transaction(async tx => {
      const state = await loadMatch(tx, matchId);
      if (state.match.status !== 'CREATED') throw new Error('This match has already started. Open its scoreboard.');
      if (![state.match.team1Name, state.match.team2Name].includes(setup.battingFirstTeam)) throw new Error('Choose one of the match teams to bat first.');
      const innings = newInnings(state, 1, setup.battingFirstTeam, setup, id);
      state.innings.push(innings);
      Object.assign(state.match, { status: 'IN_PROGRESS', battingFirstTeam: setup.battingFirstTeam, updatedAt: clock(), revision: state.match.revision + 1 });
      await linkPlayers(tx, state, innings);
      await saveMatch(tx, state);
      return { ...state.match, innings: state.innings };
    }),
    startSecondInnings: (matchId: string, setup: Omit<StartMatchInput, 'battingFirstTeam'>) => db.transaction(async tx => {
      const state = await loadMatch(tx, matchId);
      const first = state.innings.find(i => i.inningsNumber === 1);
      if (!first || first.status !== 'COMPLETED' || state.match.currentInnings !== 1 || state.match.status !== 'IN_PROGRESS') throw new Error('End the first innings before starting the chase.');
      const innings = newInnings(state, 2, first.bowlingTeamName, setup, id);
      state.innings.push(innings);
      Object.assign(state.match, { currentInnings: 2, updatedAt: clock(), revision: state.match.revision + 1 });
      await linkPlayers(tx, state, innings);
      await saveMatch(tx, state);
      return scoreboard(tx, innings.id);
    }),
    perform,
    finishMatch: async (matchId: string, command: Command) => {
      const match = await repository.getMatch(matchId);
      const second = match.innings.find(i => i.inningsNumber === 2);
      if (!second) throw new Error('Start the second innings before finishing the match.');
      await perform(second.id, { kind: 'END_INNINGS' }, command);
      return repository.getMatch(matchId);
    },
    createTeam: (value: string) => db.transaction(async tx => {
      const name = playerName(value);
      if (await tx.getFirstAsync('SELECT id FROM teams WHERE nameKey=?', name.toLowerCase())) throw new Error('That team is already saved. Choose a different name.');
      const team = { id: id(), name, players: [] };
      await tx.runAsync('INSERT INTO teams(id,name,nameKey) VALUES (?,?,?)', team.id, name, name.toLowerCase());
      return team;
    }),
    addTeamPlayer: (teamId: string, value: string) => db.transaction(async tx => {
      const name = playerName(value);
      if (!await tx.getFirstAsync('SELECT id FROM teams WHERE id=?', teamId)) throw new Error('Team not found on this device.');
      if (await tx.getFirstAsync('SELECT id FROM players WHERE teamId=? AND nameKey=?', teamId, name.toLowerCase())) throw new Error('That player is already in this team.');
      const player = { id: id(), name, teamId };
      await tx.runAsync('INSERT INTO players(id,teamId,name,nameKey) VALUES (?,?,?,?)', player.id, teamId, name, name.toLowerCase());
      return player;
    }),
    getTeams: (): Promise<Team[]> => db.transaction(async tx => {
      const teams = await tx.getAllAsync<{ id: string; name: string }>('SELECT id,name FROM teams ORDER BY name');
      const result: Team[] = [];
      for (const team of teams) {
        const players = await tx.getAllAsync<{ id: string; name: string }>('SELECT id,name FROM players WHERE teamId=? ORDER BY name', team.id);
        const withStats: Team['players'] = [];
        for (const player of players) {
          const rows = await tx.getAllAsync<LocalPlayer & { matchId: string }>('SELECT p.*,i.matchId FROM player_innings p JOIN innings i ON i.id=p.inningsId WHERE p.playerId=?', player.id);
          const batting = rows.filter(p => p.playerType === 'BATSMAN'), bowling = rows.filter(p => p.playerType === 'BOWLER');
          const sum = (list: LocalPlayer[], key: 'runs' | 'ballsFaced' | 'runsConceded' | 'ballsBowled' | 'wicketsTaken') => list.reduce((n, p) => n + p[key], 0);
          const runs = sum(batting, 'runs'), ballsFaced = sum(batting, 'ballsFaced'), ballsBowled = sum(bowling, 'ballsBowled'), runsConceded = sum(bowling, 'runsConceded');
          const outs = batting.filter(p => p.isOut).length;
          withStats.push({ ...player, stats: { matches: new Set(rows.map(p => p.matchId)).size, runs, ballsFaced, wickets: sum(bowling, 'wicketsTaken'), ballsBowled, runsConceded,
            strikeRate: ballsFaced ? Number((runs * 100 / ballsFaced).toFixed(2)) : null,
            economy: ballsBowled ? Number((runsConceded * 6 / ballsBowled).toFixed(2)) : null,
            average: outs ? Number((runs / outs).toFixed(2)) : null,
          } });
        }
        result.push({ ...team, players: withStats });
      }
      return result;
    }),
    importLegacy: (payload: { version: number; teams: { id: string; name: string; players: { id: string; name: string }[] }[]; matches: Record<string, unknown>[] }) => db.transaction(async tx => {
      if (payload.version !== 1 || !Array.isArray(payload.teams) || !Array.isArray(payload.matches)) throw new Error('The saved-match export has an unsupported format. Update the app and try again.');
      const sourceId = 'neon-v1';
      if (await tx.getFirstAsync('SELECT sourceId FROM imports WHERE sourceId=?', sourceId)) return { teams: payload.teams.length, matches: payload.matches.length, alreadyImported: true };
      const existing = await tx.getFirstAsync<{ count: number }>('SELECT (SELECT COUNT(*) FROM teams) + (SELECT COUNT(*) FROM matches) AS count');
      if ((existing?.count ?? 0) > 0) throw new Error('This device already has saved teams or matches. Import is available only into an empty account database, so your local scores stay safe.');
      for (const source of payload.teams) {
        await tx.runAsync('INSERT INTO teams(id,name,nameKey) VALUES (?,?,?)', source.id, source.name, source.name.toLowerCase());
        for (const player of source.players) await tx.runAsync('INSERT INTO players(id,teamId,name,nameKey) VALUES (?,?,?,?)', player.id, source.id, player.name, player.name.toLowerCase());
      }
      for (const value of payload.matches) {
        const raw = value as Record<string, any>;
        const match = { ...raw, createdAt: new Date(raw.createdAt).toISOString(), updatedAt: new Date(raw.updatedAt).toISOString() } as LocalMatch;
        const innings: LocalInnings[] = (raw.innings ?? []).map((row: any) => ({
          ...row, matchId: raw.id,
          players: (row.players ?? []).map((p: any) => ({ ...p, inningsId: row.id, isOut: Boolean(p.isOut) })),
          ballEvents: (row.ballEvents ?? []).map((event: any) => ({ ...event, inningsId: row.id, createdAt: new Date(event.createdAt).toISOString() })),
        }));
        await saveMatch(tx, { match, innings });
        for (const action of raw.actions ?? []) await put(tx, 'match_actions', { ...action, snapshot: action.snapshot == null ? null : JSON.stringify(action.snapshot), undoneAt: action.undoneAt ? new Date(action.undoneAt).toISOString() : null, createdAt: new Date(action.createdAt).toISOString() });
      }
      await tx.runAsync('INSERT INTO imports(sourceId,importedAt) VALUES (?,?)', sourceId, clock());
      return { teams: payload.teams.length, matches: payload.matches.length, alreadyImported: false };
    }),
  };
  return repository;
}
export type CricketRepository = ReturnType<typeof createCricketRepository>;
