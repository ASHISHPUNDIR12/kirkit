import './setupIntegration.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { app } from '../src/app.js';
import { prisma } from '../src/services/database.js';

test('match API validates, persists, lists newest first, and handles database errors', async () => {
  const prefix = `API test ${randomUUID().slice(0, 8)}`;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/matches`;
  let token = '';
  const email = `${randomUUID()}@example.test`;
  const fetch = (input: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return globalThis.fetch(input, { ...options, headers });
  };
  const post = (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  try {
    const signup = await globalThis.fetch(`http://127.0.0.1:${address.port}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'integration-password-123' }),
    });
    assert.equal(signup.status, 201);
    token = (await signup.json()).token;
    for (const body of [{}, { team1Name: prefix, team2Name: 'Warriors', oversLimit: 0 }, { team1Name: prefix, team2Name: prefix.toUpperCase(), oversLimit: 5 }]) {
      const response = await post(body);
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, 'string');
    }
    const malformed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'Request body must be valid JSON.');
    assert.equal(await prisma.match.count({ where: { team1Name: { startsWith: prefix } } }), 0);

    const firstResponse = await post({ team1Name: ` ${prefix} A `, team2Name: ' Warriors ', oversLimit: 7, status: 'COMPLETED', target: 999 });
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    assert.equal(first.team1Name, `${prefix} A`);
    assert.equal(first.team2Name, 'Warriors');
    assert.equal(first.status, 'CREATED');
    assert.equal(first.target, null);
    const stored = await prisma.match.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(stored.oversLimit, 7);
    assert.equal(await prisma.innings.count({ where: { matchId: first.id } }), 0);

    const secondResponse = await post({ team1Name: `${prefix} B`, team2Name: 'Warriors', oversLimit: 1 });
    assert.equal(secondResponse.status, 201);
    const second = await secondResponse.json();
    for (let attempt = 0; attempt < 2; attempt++) {
      const listedResponse = await fetch(url);
      assert.equal(listedResponse.status, 200);
      const listed = await listedResponse.json();
      assert.ok(Array.isArray(listed));
      assert.ok(listed.findIndex(match => match.id === second.id) < listed.findIndex(match => match.id === first.id));
      assert.ok(listed.some(match => match.id === first.id && match.oversLimit === 7));
    }

    const setupMatchResponse = await post({ team1Name: `${prefix} Setup`, team2Name: 'Rangers', oversLimit: 5 });
    assert.equal(setupMatchResponse.status, 201);
    const setupMatch = await setupMatchResponse.json();
    const startUrl = `${url}/${setupMatch.id}/start`;
    const start = (body: unknown) => fetch(startUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await start({ battingFirstTeam: 'Other', strikerName: 'Ashish', nonStrikerName: 'Rahul', bowlerName: 'Aman' })).status, 400);
    assert.equal((await start({ battingFirstTeam: `${prefix} Setup`, strikerName: 'Ashish', nonStrikerName: 'Ashish', bowlerName: 'Aman' })).status, 400);
    assert.equal((await start({ battingFirstTeam: `${prefix} Setup`, strikerName: '', nonStrikerName: 'Rahul', bowlerName: 'Aman' })).status, 400);
    const startedResponse = await start({ battingFirstTeam: 'Rangers', strikerName: ' Ashish ', nonStrikerName: 'Rahul', bowlerName: 'Aman' });
    assert.equal(startedResponse.status, 200);
    const started = await startedResponse.json();
    assert.equal(started.status, 'IN_PROGRESS');
    assert.equal(started.battingFirstTeam, 'Rangers');
    assert.equal(started.innings.length, 1);
    assert.equal(started.innings[0].battingTeamName, 'Rangers');
    assert.equal(started.innings[0].bowlingTeamName, `${prefix} Setup`);
    assert.deepEqual(started.innings[0].players.map((player: { playerName: string; playerType: string; activeRole: string }) => [player.playerName, player.playerType, player.activeRole]), [
      ['Ashish', 'BATSMAN', 'STRIKER'],
      ['Rahul', 'BATSMAN', 'NON_STRIKER'],
      ['Aman', 'BOWLER', 'BOWLER'],
    ]);
    assert.equal((await start({ battingFirstTeam: 'Rangers', strikerName: 'Ashish', nonStrikerName: 'Rahul', bowlerName: 'Aman' })).status, 409);
    const missing = await fetch(`${url}/missing-match-id/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ battingFirstTeam: 'Rangers', strikerName: 'Ashish', nonStrikerName: 'Rahul', bowlerName: 'Aman' }) });
    assert.equal(missing.status, 404);
    assert.equal(await prisma.innings.count({ where: { matchId: setupMatch.id } }), 1);

    const inningsId = started.innings[0].id;
    const scoreUrl = `http://127.0.0.1:${address.port}/innings/${inningsId}/score`;
    const score = (runs: unknown) => fetch(scoreUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
    const bowlerUrl = `http://127.0.0.1:${address.port}/innings/${inningsId}/change-bowler`;
    const nextBowler = (playerName: unknown) => fetch(bowlerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName }) });
    assert.equal((await nextBowler('Naveed')).status, 409);
    for (const runs of [5, -1, 1.5, '4']) {
      assert.equal((await score(runs)).status, 400);
    }
    for (const runs of [1, 4, 0, 6, 2, 3]) {
      const scoreResponse = await score(runs);
      assert.equal(scoreResponse.status, 200);
      const scoreboard = await scoreResponse.json();
      assert.equal(scoreboard.runs, runs === 1 ? 1 : runs === 4 ? 5 : runs === 0 ? 5 : runs === 6 ? 11 : runs === 2 ? 13 : 16);
      if (runs === 1) {
        assert.equal(scoreboard.players.find((player: { activeRole: string }) => player.activeRole === 'STRIKER').playerName, 'Rahul');
      }
    }
    const persistedInningsResponse = await fetch(`http://127.0.0.1:${address.port}/innings/${inningsId}`);
    assert.equal(persistedInningsResponse.status, 200);
    const persistedInnings = await persistedInningsResponse.json();
    assert.equal(persistedInnings.runs, 16);
    assert.equal(persistedInnings.completedOvers, 1);
    assert.equal(persistedInnings.ballsInCurrentOver, 0);
    assert.equal(persistedInnings.ballEvents.length, 6);
    assert.deepEqual(persistedInnings.ballEvents.map((event: { sequence: number; overNumber: number; ballNumber: number; eventType: string }) => [event.sequence, event.overNumber, event.ballNumber, event.eventType]), [
      [6, 1, 6, 'THREE'], [5, 1, 5, 'TWO'], [4, 1, 4, 'SIX'], [3, 1, 3, 'DOT'], [2, 1, 2, 'FOUR'], [1, 1, 1, 'ONE'],
    ]);
    const storedPlayers = persistedInnings.players;
    assert.equal(storedPlayers.find((player: { activeRole: string }) => player.activeRole === 'STRIKER').playerName, 'Rahul');
    assert.equal(storedPlayers.find((player: { playerName: string }) => player.playerName === 'Rahul').runs, 15);
    assert.equal(storedPlayers.find((player: { playerName: string }) => player.playerName === 'Rahul').ballsFaced, 5);
    assert.equal(storedPlayers.find((player: { playerName: string }) => player.playerName === 'Ashish').runs, 1);
    assert.equal(storedPlayers.find((player: { playerName: string }) => player.playerName === 'Ashish').ballsFaced, 1);
    const previousBowler = storedPlayers.find((player: { playerName: string }) => player.playerName === 'Aman');
    assert.equal(previousBowler.runsConceded, 16);
    assert.equal(previousBowler.ballsBowled, 6);
    assert.equal(previousBowler.activeRole, null);
    assert.equal((await score(1)).status, 409);
    assert.equal((await nextBowler('')).status, 400);
    const changedBowlerResponse = await nextBowler('Naveed');
    assert.equal(changedBowlerResponse.status, 200);
    const changedBowler = await changedBowlerResponse.json();
    assert.equal(changedBowler.players.find((player: { activeRole: string }) => player.activeRole === 'BOWLER').playerName, 'Naveed');
    const nextOverScoreResponse = await score(2);
    assert.equal(nextOverScoreResponse.status, 200);
    const nextOver = await nextOverScoreResponse.json();
    assert.equal(nextOver.runs, 18);
    assert.equal(nextOver.completedOvers, 1);
    assert.equal(nextOver.ballsInCurrentOver, 1);
    assert.equal(nextOver.ballEvents[0].overNumber, 2);
    assert.equal(nextOver.ballEvents[0].ballNumber, 1);
    assert.equal(nextOver.players.find((player: { activeRole: string }) => player.activeRole === 'BOWLER').ballsBowled, 1);
    const wicketResponse = await fetch(`http://127.0.0.1:${address.port}/innings/${inningsId}/wicket`, { method: 'POST' });
    assert.equal(wicketResponse.status, 200);
    const wicketBoard = await wicketResponse.json();
    assert.equal(wicketBoard.wickets, 1);
    assert.equal(wicketBoard.ballsInCurrentOver, 2);
    assert.equal(wicketBoard.pendingBatsmanRole, 'STRIKER');
    assert.equal(wicketBoard.ballEvents[0].eventType, 'WICKET');
    assert.equal(wicketBoard.players.find((player: { playerName: string }) => player.playerName === 'Rahul').isOut, true);
    assert.equal(wicketBoard.players.find((player: { playerName: string }) => player.playerName === 'Ashish').activeRole, 'NON_STRIKER');
    assert.equal((await score(1)).status, 409);
    const replacementResponse = await fetch(`http://127.0.0.1:${address.port}/innings/${inningsId}/new-batsman`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName: 'New Batter' }),
    });
    assert.equal(replacementResponse.status, 200);
    const replacementBoard = await replacementResponse.json();
    assert.equal(replacementBoard.pendingBatsmanRole, null);
    assert.equal(replacementBoard.players.find((player: { activeRole: string }) => player.activeRole === 'STRIKER').playerName, 'New Batter');
    const extraUrl = `http://127.0.0.1:${address.port}/innings/${inningsId}/extra`;
    const extra = (eventType: unknown) => fetch(extraUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType }) });
    assert.equal((await extra('INVALID')).status, 400);
    for (const eventType of ['WIDE', 'NO_BALL']) {
      const extraResponse = await extra(eventType);
      assert.equal(extraResponse.status, 200);
      const scoreboard = await extraResponse.json();
      assert.equal(scoreboard.ballsInCurrentOver, 2);
    }
    const afterExtras = await fetch(`http://127.0.0.1:${address.port}/innings/${inningsId}`).then(response => response.json());
    assert.equal(afterExtras.runs, 20);
    assert.equal(afterExtras.players.find((player: { playerName: string }) => player.playerName === 'New Batter').runs, 0);
    assert.equal(afterExtras.players.find((player: { playerName: string }) => player.playerName === 'Naveed').runsConceded, 4);
    assert.deepEqual(afterExtras.ballEvents.slice(0, 2).map((event: { eventType: string }) => event.eventType), ['NO_BALL', 'WIDE']);
    const secondSetupUrl = `${url}/${setupMatch.id}/start-second-innings`;
    const secondSetup = (body: unknown) => fetch(secondSetupUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await secondSetup({ strikerName: 'Chaser A', nonStrikerName: 'Chaser B', bowlerName: 'Bowler' })).status, 409);
    const endFirst = await fetch(`http://127.0.0.1:${address.port}/innings/${inningsId}/end`, { method: 'POST' });
    assert.equal(endFirst.status, 200);
    const endedFirst = await endFirst.json();
    assert.equal(endedFirst.match.firstInningsRuns, 20);
    assert.equal(endedFirst.match.target, 21);
    assert.equal(endedFirst.status, 'COMPLETED');
    assert.equal((await secondSetup({ strikerName: 'Same', nonStrikerName: 'Same', bowlerName: 'Bowler' })).status, 400);
    const secondStartResponse = await secondSetup({ strikerName: 'Chaser A', nonStrikerName: 'Chaser B', bowlerName: 'Bowler' });
    assert.equal(secondStartResponse.status, 201);
    const secondInnings = await secondStartResponse.json();
    assert.equal(secondInnings.inningsNumber, 2);
    assert.equal(secondInnings.battingTeamName, `${prefix} Setup`);
    assert.equal(secondInnings.bowlingTeamName, 'Rangers');
    assert.equal(secondInnings.match.target, 21);
    for (const runs of [6, 6, 6, 3]) {
      const chaseResponse = await fetch(`http://127.0.0.1:${address.port}/innings/${secondInnings.id}/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
      assert.equal(chaseResponse.status, 200);
    }
    const completedMatch = await prisma.match.findUniqueOrThrow({ where: { id: setupMatch.id } });
    assert.equal(completedMatch.status, 'COMPLETED');
    assert.equal(completedMatch.winner, `${prefix} Setup`);
    assert.equal(completedMatch.result, `${prefix} Setup won by 10 wickets`);
    const matchDetailsResponse = await fetch(`${url}/${setupMatch.id}`);
    assert.equal(matchDetailsResponse.status, 200);
    const matchDetails = await matchDetailsResponse.json();
    assert.equal(matchDetails.innings.length, 2);
    assert.equal(matchDetails.result, `${prefix} Setup won by 10 wickets`);
    assert.ok(matchDetails.innings[0].ballEvents.some((event: { eventType: string }) => event.eventType === 'WICKET'));
    assert.ok(matchDetails.innings[0].ballEvents.some((event: { eventType: string }) => event.eventType === 'WIDE'));
    assert.ok(matchDetails.innings[0].ballEvents.some((event: { eventType: string }) => event.eventType === 'NO_BALL'));
    assert.equal((await fetch(`${url}/missing-match`)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/innings/missing-innings`)).status, 404);

    const original = prisma.match.findMany;
    prisma.match.findMany = async () => { throw new Error('Simulated database outage'); };
    try {
      const failed = await fetch(url);
      assert.equal(failed.status, 503);
      assert.equal((await failed.json()).error, 'Unable to load matches. Please try again shortly.');
    } finally { prisma.match.findMany = original; }
  } finally {
    // Only remove fixtures from this test invocation; leave user matches alone.
    await prisma.match.deleteMany({ where: { team1Name: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { email } });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
