import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateResult } from '../src/utils/calculateResult.js';

test('calculates a chase win by remaining wickets', () => {
  assert.deepEqual(calculateResult({
    battingFirstTeam: 'Tigers', battingSecondTeam: 'Warriors', firstInningsRuns: 50, secondInningsRuns: 51, secondInningsWickets: 4,
  }), { winner: 'Warriors', result: 'Warriors won by 6 wickets' });
});

test('calculates a first-innings win by runs', () => {
  assert.deepEqual(calculateResult({
    battingFirstTeam: 'Tigers', battingSecondTeam: 'Warriors', firstInningsRuns: 50, secondInningsRuns: 42, secondInningsWickets: 5,
  }), { winner: 'Tigers', result: 'Tigers won by 8 runs' });
});

test('records a tie when scores are equal', () => {
  assert.deepEqual(calculateResult({
    battingFirstTeam: 'Tigers', battingSecondTeam: 'Warriors', firstInningsRuns: 50, secondInningsRuns: 50, secondInningsWickets: 3,
  }), { winner: null, result: 'Match tied' });
});
