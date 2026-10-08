import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateScorecard } from '../src/utils/scorecard.js';

test('scorecard handles extras, wicket partnerships, legal-ball rates and boundaries', () => {
  const card = calculateScorecard({ status: 'IN_PROGRESS', players: [
    { id: 'a', playerName: 'A', playerType: 'BATSMAN', runs: 4, ballsFaced: 2, ballsBowled: 0, runsConceded: 0, wicketsTaken: 0, isOut: true },
    { id: 'c', playerName: 'C', playerType: 'BOWLER', runs: 0, ballsFaced: 0, ballsBowled: 2, runsConceded: 6, wicketsTaken: 1, isOut: false },
  ], ballEvents: [
    { sequence: 1, overNumber: 1, ballNumber: 1, runs: 4, eventType: 'FOUR', batsmanName: 'A', batsmanId: 'a', nonStrikerName: 'B' },
    { sequence: 2, overNumber: 1, ballNumber: 2, runs: 1, eventType: 'WIDE', batsmanName: 'A', nonStrikerName: 'B' },
    { sequence: 3, overNumber: 1, ballNumber: 2, runs: 0, eventType: 'WICKET', batsmanName: 'A', nonStrikerName: 'B' },
    { sequence: 4, overNumber: 1, ballNumber: 3, runs: 1, eventType: 'NO_BALL', batsmanName: 'D', nonStrikerName: 'B' },
  ] });
  assert.deepEqual(card.extras, { wides: 1, noBalls: 1, total: 2 });
  assert.equal(card.batting[0].strikeRate, 200);
  assert.equal(card.batting[0].fours, 1);
  assert.equal(card.bowling[0].economy, 18);
  assert.equal(card.runRate, 18);
  assert.deepEqual(card.fallOfWickets, [{ wicket: 1, runs: 5, overs: '0.2', playerName: 'A' }]);
  assert.deepEqual(card.partnerships, [
    { wicket: 1, players: ['A', 'B'], runs: 5, balls: 2, ended: true },
    { wicket: 2, players: ['D', 'B'], runs: 1, balls: 0, ended: false },
  ]);
  assert.equal(card.overs[0].legalBalls, 2);
  assert.equal(card.overs[0].totalRuns, 6);
});
test('empty innings have no fabricated statistics', () => {
  const card = calculateScorecard({ players: [], ballEvents: [], status: 'IN_PROGRESS' });
  assert.equal(card.runRate, null);
  assert.deepEqual(card.partnerships, []);
  assert.deepEqual(card.overs, []);
});
