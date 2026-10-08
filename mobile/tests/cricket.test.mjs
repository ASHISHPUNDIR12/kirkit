import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDatabase } from './helpers/sqlite.mjs';
import { createCricketRepository } from '../src/cricket/repository.ts';
import { calculateScorecard as serverScorecard } from '../../backend/src/utils/scorecard.ts';
const command = revision => ({ requestId: randomUUID(), revision });
const setup = { strikerName: 'A', nonStrikerName: 'B', bowlerName: 'C' };

async function start(repo, oversLimit = 2, ids = {}) {
  const match = await repo.createMatch({ team1Name: 'Tigers', team2Name: 'Rangers', oversLimit, ...ids });
  const started = await repo.startMatch(match.id, { ...setup, battingFirstTeam: 'Tigers' });
  return { matchId: match.id, inningsId: started.innings[0].id };
}

test('local scoring preserves duplicate protection, undo, strike, career stats and chase results', async () => {
  const db = await openTestDatabase();
  const repo = createCricketRepository(db, randomUUID);
  try {
    const t = await repo.createTeam('Tigers'), r = await repo.createTeam('Rangers');
    for (const name of ['A','B','E']) await repo.addTeamPlayer(t.id, name);
    for (const name of ['C','D']) await repo.addTeamPlayer(r.id, name);
    await assert.rejects(repo.createTeam(' tigers '));
    await assert.rejects(repo.addTeamPlayer(t.id, ' a '));
    await assert.rejects(repo.addTeamPlayer('another-account-team', 'X'));
    const { matchId, inningsId: id } = await start(repo, 2, { team1Id: t.id, team2Id: r.id });
    const initial = await repo.getInnings(id);
    assert.ok(initial.players.every(p => p.playerId));
    const cmd = command(initial.match.revision);
    const [first, retry] = await Promise.all([repo.perform(id, { kind: 'SCORE', runs: 4 }, cmd), repo.perform(id, { kind: 'SCORE', runs: 4 }, cmd)]);
    assert.equal(first.runs, 4); assert.equal(retry.runs, 4);
    await assert.rejects(repo.perform(id, { kind: 'SCORE', runs: 6 }, cmd), /different score/);
    await assert.rejects(repo.perform(id, { kind: 'SCORE', runs: 1 }, command(initial.match.revision)), /score has changed/);
    const undoCmd = command(first.match.revision);
    assert.equal((await repo.perform(id, { kind: 'UNDO' }, undoCmd)).runs, 0);
    assert.equal((await repo.perform(id, { kind: 'UNDO' }, undoCmd)).runs, 0);
    assert.equal((await repo.perform(id, { kind: 'SCORE', runs: 4 }, cmd)).runs, 0);
    for (let i = 0; i < 5; i++) await repo.perform(id, { kind: 'SCORE', runs: 0 }, command());
    const before = await repo.getInnings(id);
    await repo.perform(id, { kind: 'SCORE', runs: 1 }, command());
    assert.deepEqual((await repo.perform(id, { kind: 'UNDO' }, command())).players, before.players);
    await repo.perform(id, { kind: 'WICKET' }, command());
    await assert.rejects(repo.perform(id, { kind: 'WIDE' }, command()), /next batsman/);
    await repo.perform(id, { kind: 'NEW_BATSMAN', playerName: 'E' }, command());
    await repo.perform(id, { kind: 'CHANGE_BOWLER', playerName: 'D' }, command());
    await repo.perform(id, { kind: 'UNDO' }, command());
    await repo.perform(id, { kind: 'UNDO' }, command());
    assert.deepEqual((await repo.perform(id, { kind: 'UNDO' }, command())).players, before.players);
    await repo.perform(id, { kind: 'WIDE' }, command());
    await repo.perform(id, { kind: 'NO_BALL' }, command());
    await repo.perform(id, { kind: 'UNDO' }, command());
    const details = await repo.getMatch(matchId);
    assert.deepEqual(details.innings[0].scorecard, serverScorecard(details.innings[0]));
    assert.deepEqual(details.innings[0].scorecard.extras, { wides: 1, noBalls: 0, total: 1 });
    await repo.perform(id, { kind: 'END_INNINGS' }, command());
    assert.equal((await repo.perform(id, { kind: 'UNDO' }, command())).match.target, null);
    await repo.perform(id, { kind: 'END_INNINGS' }, command());
    const second = await repo.startSecondInnings(matchId, { strikerName: 'C', nonStrikerName: 'D', bowlerName: 'A' });
    await assert.rejects(repo.perform(id, { kind: 'UNDO' }, command()), /current innings/);
    const win = await repo.perform(second.id, { kind: 'SCORE', runs: 6 }, command());
    assert.equal(win.match.result, 'Rangers won by 10 wickets');
    const reverted = await repo.perform(second.id, { kind: 'UNDO' }, command());
    assert.equal(reverted.match.status, 'IN_PROGRESS'); assert.equal(reverted.match.result, null);
    const c = (await repo.getTeams()).find(t => t.id === r.id).players.find(p => p.name === 'C');
    assert.equal(c.stats.matches, 1); assert.equal(c.stats.runs, 0); assert.equal(c.stats.runsConceded, 1);
    await repo.perform(second.id, { kind: 'NO_BALL' }, command());
    assert.equal((await repo.perform(second.id, { kind: 'WIDE' }, command())).match.status, 'COMPLETED');
    assert.equal((await repo.perform(second.id, { kind: 'UNDO' }, command())).ballsInCurrentOver, 0);
  } finally { db.close(); }
});

test('resume, action history and account isolation survive closing SQLite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kirkit-resume-'));
  let db;
  try {
    const path = join(dir, 'a.db');
    db = await openTestDatabase(path);
    let repo = createCricketRepository(db, randomUUID);
    const { matchId, inningsId } = await start(repo);
    await repo.perform(inningsId, { kind: 'SCORE', runs: 6 }, command());
    await repo.perform(inningsId, { kind: 'WICKET' }, command());
    db.close(); db = undefined;
    await assert.rejects(openTestDatabase(path, 'wrong-user'), /another account/);
    db = await openTestDatabase(path); repo = createCricketRepository(db, randomUUID);
    const reopened = await repo.getInnings(inningsId);
    assert.equal(reopened.pendingBatsmanRole, 'STRIKER'); assert.equal(reopened.runs, 6); assert.equal(reopened.canUndo, true);
    await repo.perform(inningsId, { kind: 'UNDO' }, command());
    assert.equal((await repo.getMatch(matchId)).innings[0].wickets, 0);
  } finally { db?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('legacy cloud export imports completely in one transaction without replacing local scores', async () => {
  const db = await openTestDatabase();
  const otherDb = await openTestDatabase();
  const repo = createCricketRepository(db, randomUUID, () => '2026-10-08T00:00:00.000Z');
  const otherRepo = createCricketRepository(otherDb, randomUUID);
  try {
    const payload = {
      version: 1,
      teams: [{ id: 'old-team', name: 'Tigers', players: [{ id: 'old-player', name: 'A' }] }],
      matches: [{
        id: 'old-match', team1Id: 'old-team', team2Id: null, team1Name: 'Tigers', team2Name: 'Rangers',
        oversLimit: 5, battingFirstTeam: 'Tigers', tossWinner: null, tossDecision: null,
        currentInnings: 1, status: 'IN_PROGRESS', firstInningsRuns: null, firstInningsWickets: null,
        target: null, winner: null, result: null, revision: 2,
        createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T01:00:00.000Z',
        innings: [{
          id: 'old-innings', inningsNumber: 1, battingTeamName: 'Tigers', bowlingTeamName: 'Rangers',
          runs: 4, wickets: 0, completedOvers: 0, ballsInCurrentOver: 1, pendingBatsmanRole: null, status: 'IN_PROGRESS',
          players: [{ id: 'old-player-innings', inningsId: 'old-innings', playerId: 'old-player', playerName: 'A', playerType: 'BATSMAN', activeRole: 'STRIKER', runs: 4, ballsFaced: 1, runsConceded: 0, ballsBowled: 0, wicketsTaken: 0, isOut: false }],
          ballEvents: [{ id: 'old-event', inningsId: 'old-innings', sequence: 1, overNumber: 1, ballNumber: 1, batsmanId: 'old-player', batsmanName: 'A', nonStrikerName: 'B', bowlerName: 'C', runs: 4, eventType: 'FOUR', createdAt: '2026-10-07T00:05:00.000Z' }],
        }],
        actions: [{ id: 'old-action', matchId: 'old-match', inningsId: 'old-innings', requestId: 'request-1', fingerprint: '{}', kind: 'SCORE', revision: 2, snapshot: { runs: 0 }, undoneAt: null, createdAt: '2026-10-07T00:05:00.000Z' }],
      }],
    };
    assert.deepEqual(await repo.importLegacy(payload), { teams: 1, matches: 1, alreadyImported: false });
    const imported = await repo.getMatch('old-match');
    assert.equal(imported.innings[0].runs, 4);
    assert.equal(imported.innings[0].ballEvents[0].eventType, 'FOUR');
    assert.deepEqual(imported.innings[0].scorecard.extras, { wides: 0, noBalls: 0, total: 0 });
    assert.equal((await repo.getTeams())[0].players[0].name, 'A');
    assert.deepEqual(await repo.importLegacy(payload), { teams: 1, matches: 1, alreadyImported: true });
    assert.equal((await repo.createTeam('Local')).name, 'Local');
    await otherRepo.createMatch({ team1Name: 'Local Tigers', team2Name: 'Local Bears', oversLimit: 3 });
    await assert.rejects(otherRepo.importLegacy(payload), /only into an empty account database/);
    assert.equal((await otherRepo.getMatches()).length, 1);
  } finally { db.close(); otherDb.close(); }
});

test('over-ending wicket, ten wickets, ties and concurrent stale actions follow existing rules', async () => {
  const db = await openTestDatabase(); const repo = createCricketRepository(db, randomUUID);
  try {
    const { inningsId: id, matchId } = await start(repo, 1);
    for (let i = 0; i < 5; i++) await repo.perform(id, { kind: 'SCORE', runs: 0 }, command());
    let value = await repo.perform(id, { kind: 'WICKET' }, command());
    assert.equal(value.status, 'COMPLETED'); assert.equal(value.match.target, 1);
    value = await repo.perform(id, { kind: 'UNDO' }, command());
    assert.equal(value.ballsInCurrentOver, 5); assert.equal(value.wickets, 0);
    await repo.perform(id, { kind: 'SCORE', runs: 0 }, command());
    const second = await repo.startSecondInnings(matchId, setup);
    await repo.perform(second.id, { kind: 'END_INNINGS' }, command());
    assert.equal((await repo.getMatch(matchId)).result, 'Match tied');
    const another = await start(repo, 20);
    for (let wicket = 1; wicket <= 10; wicket++) {
      value = await repo.perform(another.inningsId, { kind: 'WICKET' }, command());
      if (wicket < 10) {
        await repo.perform(another.inningsId, { kind: 'NEW_BATSMAN', playerName: `Replacement ${wicket}` }, command());
        if (wicket === 6) await repo.perform(another.inningsId, { kind: 'CHANGE_BOWLER', playerName: 'C' }, command());
      }
    }
    assert.equal(value.wickets, 10); assert.equal(value.status, 'COMPLETED');
    const concurrent = await start(repo); const score = await repo.getInnings(concurrent.inningsId);
    const results = await Promise.allSettled([1, 2].map(runs => repo.perform(concurrent.inningsId, { kind: 'SCORE', runs }, command(score.match.revision))));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  } finally { db.close(); }
});

test('a failed save commits neither a delivery nor its snapshot', async () => {
  const db = await openTestDatabase(); const repo = createCricketRepository(db, randomUUID);
  try {
    const { inningsId } = await start(repo);
    await db.transaction(tx => tx.execAsync("CREATE TRIGGER fail_action BEFORE INSERT ON match_actions BEGIN SELECT RAISE(ABORT, 'storage failure'); END;"));
    await assert.rejects(repo.perform(inningsId, { kind: 'SCORE', runs: 4 }, command()));
    const innings = await repo.getInnings(inningsId);
    assert.equal(innings.runs, 0); assert.equal(innings.ballEvents.length, 0); assert.equal(innings.canUndo, false);
  } finally { db.close(); }
});
