import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateMatch } from '../src/utils/validateMatch.js';

test('trims names, accepts custom overs, and ignores client-supplied match state', () => {
  assert.deepEqual(validateMatch({ team1Name: '  Tigers ', team2Name: ' Warriors  ', oversLimit: 7, status: 'COMPLETED', winner: 'Tigers' }), {
    valid: true, data: { team1Name: 'Tigers', team2Name: 'Warriors', oversLimit: 7 },
  });
});

test('rejects invalid bodies and team names', () => {
  for (const body of [null, undefined, [], 'match', {},
    { team1Name: 123, team2Name: 'Warriors', oversLimit: 5 },
    { team1Name: '  ', team2Name: 'Warriors', oversLimit: 5 },
    { team1Name: 'Tigers', team2Name: ' tIGERS ', oversLimit: 5 },
    { team1Name: 'a'.repeat(61), team2Name: 'Warriors', oversLimit: 5 }]) {
    assert.equal(validateMatch(body).valid, false);
  }
});

test('rejects nonnumeric, fractional, nonpositive, or overflowing overs', () => {
  for (const oversLimit of [undefined, null, '5', true, 0, -1, 1.5, Infinity, NaN, 2147483648]) {
    assert.equal(validateMatch({ team1Name: 'Tigers', team2Name: 'Warriors', oversLimit }).valid, false);
  }
});
