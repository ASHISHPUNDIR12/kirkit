import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scorecardHtml } from '../src/export/scorecardHtml.ts';
import { scorecardPdfStats } from '../src/export/scorecardStats.ts';

test('scorecard export includes complete recorded innings and escapes user content', () => {
  const html = scorecardHtml({
    id: 'm1', team1Name: '<Reds & Co>', team2Name: 'Blues', team1Id: null, team2Id: null,
    oversLimit: 5, battingFirstTeam: 'Reds', tossWinner: '<Reds>', tossDecision: 'BAT',
    status: 'IN_PROGRESS', createdAt: '2026-04-03T00:00:00.000Z',
    result: null, currentInnings: 1, firstInningsRuns: null, firstInningsWickets: null, target: null, winner: null,
    innings: [{
      id: 'i1', inningsNumber: 1, battingTeamName: 'Reds <XI>', bowlingTeamName: 'Blues', runs: 4, wickets: 0,
      completedOvers: 0, ballsInCurrentOver: 1, status: 'IN_PROGRESS', players: [],
      scorecard: {
        extras: { wides: 0, noBalls: 0, total: 0 }, runRate: 24,
        batting: [{ id: 'p1', name: 'A & B', runs: 4, balls: 1, isOut: false, strikeRate: 400, fours: 1, sixes: 0 }],
        bowling: [{ id: 'p2', name: 'C', runs: 4, wickets: 0, overs: '0.1', economy: 24 }],
        overs: [{ over: 1, runs: 4, wickets: 0, legalBalls: 1, extras: 0, totalRuns: 4, totalWickets: 0 }],
        fallOfWickets: [], partnerships: [],
      },
      ballEvents: [{ id: 'e1', sequence: 1, overNumber: 1, ballNumber: 1, batsmanName: 'A & B', bowlerName: 'C', runs: 4, eventType: 'FOUR' }],
    }],
  });
  assert.match(html, /&lt;Reds &amp; Co&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /&lt;Reds&gt; won toss, chose to bat/);
  assert.match(html, /Ball-by-ball/);
  assert.match(html, /Run rate/);
  assert.doesNotMatch(html, /<Reds/);
});

function innings(number, battingTeamName, bowlingTeamName, playerName, bowlerName) {
  const runsPerBall = number === 1 ? [4, 2, 1, 1, 1, 1] : [6, 1, 1, 1, 1, 1];
  const score = runsPerBall.reduce((total, runs) => total + runs, 0);
  return {
    id: `i${number}`, inningsNumber: number, battingTeamName, bowlingTeamName,
    runs: score, wickets: 0, completedOvers: 1, ballsInCurrentOver: 0, status: 'COMPLETED', players: [],
    scorecard: {
      extras: { wides: 0, noBalls: 0, total: 0 }, runRate: score,
      batting: [{ id: `b${number}`, name: playerName, runs: score, balls: 6, isOut: false, strikeRate: score * 100 / 6, fours: Number(runsPerBall.includes(4)), sixes: Number(runsPerBall.includes(6)) }],
      bowling: [{ id: `w${number}`, name: bowlerName, runs: score, wickets: 0, overs: '1.0', economy: score }],
      overs: [{ over: 1, runs: score, wickets: 0, legalBalls: 6, extras: 0, totalRuns: score, totalWickets: 0 }],
      fallOfWickets: [], partnerships: [],
    },
    ballEvents: runsPerBall.map((runs, n) => ({ id: `e${number}-${n}`, sequence: n + 1, overNumber: 1, ballNumber: n + 1, batsmanName: playerName, bowlerName, runs, eventType: ({ 1: 'ONE', 2: 'TWO', 4: 'FOUR', 6: 'SIX' })[runs] })),
  };
}

test('completed match PDF summary includes both teams, toss, result and both full innings', () => {
  const first = innings(1, 'Tigers', 'Rangers', 'Tiger Batter', 'Ranger Bowler');
  const second = innings(2, 'Rangers', 'Tigers', 'Ranger Batter', 'Tiger Bowler');
  const html = scorecardHtml({
    id: 'm2', team1Name: 'Tigers', team2Name: 'Rangers', team1Id: null, team2Id: null,
    oversLimit: 5, battingFirstTeam: 'Tigers', tossWinner: 'Tigers', tossDecision: 'BAT',
    status: 'COMPLETED', createdAt: '2026-04-03T00:00:00.000Z', result: 'Rangers won by 10 wickets',
    currentInnings: 2, firstInningsRuns: 10, firstInningsWickets: 0, target: 11, winner: 'Rangers', innings: [first, second],
  });
  assert.match(html, /Tigers won toss, chose to bat/);
  assert.match(html, /<b>Tigers<\/b> 10-0/);
  assert.match(html, /<b>Rangers<\/b> 11-0/);
  assert.match(html, /Rangers won by 10 wickets/);
  assert.match(html, /First innings/);
  assert.match(html, /Second innings/);
  assert.match(html, /Tiger Batter/);
  assert.match(html, /Ranger Batter/);
  assert.match(html, /Ranger Bowler/);
  assert.match(html, /Tiger Bowler/);
  assert.match(html, /<th>ER<\/th>/);
});

test('incomplete match export contains only the innings and players actually recorded', () => {
  const first = innings(1, 'Tigers', 'Rangers', 'Tiger Batter', 'Ranger Bowler');
  first.status = 'COMPLETED';
  const second = innings(2, 'Rangers', 'Tigers', 'Ranger Batter', 'Tiger Bowler');
  second.runs = 0; second.wickets = 0; second.completedOvers = 0; second.status = 'IN_PROGRESS'; second.ballEvents = [];
  second.scorecard = {
    ...second.scorecard, runRate: null,
    batting: [{ id: 'pending', name: 'Ranger Batter', runs: 0, balls: 0, isOut: false, strikeRate: null, fours: 0, sixes: 0 }],
    bowling: [{ id: 'tiger-bowler', name: 'Tiger Bowler', runs: 0, wickets: 0, overs: '0.0', economy: null }],
    overs: [],
  };
  const html = scorecardHtml({
    id: 'm3', team1Name: 'Tigers', team2Name: 'Rangers', team1Id: null, team2Id: null,
    oversLimit: 5, battingFirstTeam: 'Tigers', status: 'IN_PROGRESS', createdAt: '2026-04-03T00:00:00.000Z', result: null,
    currentInnings: 2, firstInningsRuns: 10, firstInningsWickets: 0, target: 11, winner: null, innings: [first, second],
  });
  assert.match(html, /Match in progress/);
  assert.match(html, /Ranger Batter/);
  assert.equal((html.match(/<h3>Ball-by-ball details<\/h3>/g) ?? []).length, 1);
  assert.equal((html.match(/First innings/g) ?? []).length, 1);
  assert.equal((html.match(/Second innings/g) ?? []).length, 1);
});

test('scorecard lays out both innings with saved wickets, wides and multiple bowlers', () => {
  const first = innings(1, 'Tigers', 'Rangers', 'A Batter', 'Alpha');
  first.runs = 15;
  first.wickets = 1;
  first.completedOvers = 1;
  first.ballsInCurrentOver = 1;
  first.scorecard = {
    extras: { wides: 1, noBalls: 0, total: 1 }, runRate: 12.86,
    batting: [
      { id: 'a', name: 'A Batter', runs: 5, balls: 3, isOut: true, strikeRate: 166.67, fours: 1, sixes: 0 },
      { id: 'b', name: 'B Batter', runs: 9, balls: 4, isOut: false, strikeRate: 225, fours: 0, sixes: 1 },
    ],
    bowling: [
      { id: 'alpha', name: 'Alpha', runs: 14, wickets: 1, overs: '1.0', economy: 14 },
      { id: 'beta', name: 'Beta', runs: 1, wickets: 0, overs: '0.1', economy: 6 },
    ],
    overs: [], fallOfWickets: [{ wicket: 1, runs: 6, overs: '0.3', playerName: 'A Batter' }], partnerships: [],
  };
  const event = (sequence, overNumber, ballNumber, batsmanName, batsmanId, bowlerName, runs, eventType) => ({
    id: `first-${sequence}`, sequence, overNumber, ballNumber, batsmanName, batsmanId, bowlerName, runs, eventType,
  });
  first.ballEvents = [
    event(1, 1, 1, 'A Batter', 'a', 'Alpha', 4, 'FOUR'),
    event(2, 1, 2, 'A Batter', 'a', 'Alpha', 1, 'WIDE'),
    event(3, 1, 2, 'A Batter', 'a', 'Alpha', 1, 'ONE'),
    event(4, 1, 3, 'A Batter', 'a', 'Alpha', 0, 'WICKET'),
    event(5, 1, 4, 'B Batter', 'b', 'Alpha', 6, 'SIX'),
    event(6, 1, 5, 'B Batter', 'b', 'Alpha', 1, 'ONE'),
    event(7, 1, 6, 'B Batter', 'b', 'Alpha', 1, 'ONE'),
    event(8, 2, 1, 'B Batter', 'b', 'Beta', 1, 'ONE'),
  ];
  const second = innings(2, 'Rangers', 'Tigers', 'C Batter', 'Gamma');
  const html = scorecardHtml({
    id: 'm4', team1Name: 'Tigers', team2Name: 'Rangers', team1Id: null, team2Id: null,
    oversLimit: 5, battingFirstTeam: 'Tigers', status: 'COMPLETED', createdAt: '2026-04-03T00:00:00.000Z',
    result: 'Tigers won by 5 runs', currentInnings: 2, firstInningsRuns: 15, firstInningsWickets: 1,
    target: 16, winner: 'Tigers', innings: [first, second],
  });
  assert.match(html, /<span>Tigers<\/span><strong>15-1 <small>\(1\.1\)<\/small>/);
  assert.match(html, /A Batter<\/td><td>6\/1<\/td><td>1\.3<\/td>/);
  assert.match(html, /Wides 1 · No-balls 0/);
  assert.match(html, /Alpha/);
  assert.match(html, /Beta/);
  assert.match(html, /Second innings/);
  assert.match(html, /C Batter/);
});

test('PDF-specific figures count a no-ball as faced and derive maiden overs from six legal balls', () => {
  const sample = innings(1, 'Tigers', 'Rangers', 'Tiger Batter', 'Ranger Bowler');
  sample.ballEvents = Array.from({ length: 6 }, (_, n) => ({
    id: `dot-${n}`, sequence: n + 1, overNumber: 1, ballNumber: n + 1,
    batsmanName: 'Tiger Batter', batsmanId: 'b1', bowlerName: 'Ranger Bowler', runs: 0, eventType: 'DOT',
  }));
  sample.ballEvents.push({ id: 'nb', sequence: 7, overNumber: 2, ballNumber: 1, batsmanName: 'Tiger Batter', batsmanId: 'b1', bowlerName: 'Ranger Bowler', runs: 1, eventType: 'NO_BALL' });
  sample.scorecard.batting[0].balls = 6;
  sample.scorecard.batting[0].runs = 1;
  sample.scorecard.bowling[0].overs = '1.0';
  const result = scorecardPdfStats(sample);
  assert.equal(result.batting[0].balls, 7);
  assert.equal(result.batting[0].strikeRate, 14.29);
  assert.equal(result.bowling[0].maidens, 1);
});
