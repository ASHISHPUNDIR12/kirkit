import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScorecardPdfBytes, downloadScorecardPdfWeb } from '../src/export/scorecardWebPdf.ts';
import { runNativePdfWorkflow } from '../src/export/nativePdfWorkflow.ts';

function sampleMatch() {
  const makeInnings = (number, battingTeamName, bowlingTeamName, batter, bowler, runs) => ({
    id: `i${number}`, inningsNumber: number, battingTeamName, bowlingTeamName,
    runs, wickets: 0, completedOvers: 1, ballsInCurrentOver: 0, status: 'COMPLETED', players: [],
    scorecard: {
      extras: { wides: 1, noBalls: 0, total: 1 }, runRate: runs,
      batting: [{ id: `b${number}`, name: batter, runs: runs - 1, balls: 5, isOut: false, strikeRate: (runs - 1) * 20, fours: 1, sixes: 0 }],
      bowling: [{ id: `w${number}`, name: bowler, runs, wickets: 0, overs: '1.0', economy: runs }],
      overs: [], fallOfWickets: [], partnerships: [],
    }, ballEvents: [],
  });
  return {
    id: 'm1', team1Name: 'Tigers', team2Name: 'Rangers', team1Id: null, team2Id: null,
    oversLimit: 5, battingFirstTeam: 'Tigers', tossWinner: 'Tigers', tossDecision: 'BAT',
    status: 'COMPLETED', createdAt: '2026-04-03T00:00:00.000Z', result: 'Rangers won by 2 runs',
    currentInnings: 2, firstInningsRuns: 20, firstInningsWickets: 0, target: 21, winner: 'Rangers',
    innings: [makeInnings(1, 'Tigers', 'Rangers', 'Tiger Batter', 'Ranger Bowler', 20), makeInnings(2, 'Rangers', 'Tigers', 'Ranger Batter', 'Tiger Bowler', 22)],
  };
}

test('web PDF bytes are a real multi-innings PDF with the scorecard content', () => {
  const bytes = createScorecardPdfBytes(sampleMatch());
  const pdf = new TextDecoder().decode(bytes);
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.endsWith('%%EOF'));
  assert.match(pdf, /Tigers v\/s Rangers/);
  assert.match(pdf, /Tiger Batter/);
  assert.match(pdf, /Ranger Batter/);
  assert.match(pdf, /Ranger Bowler/);
  assert.match(pdf, /Tiger Bowler/);
  assert.match(pdf, /Extras: Wides 1/);
  assert.match(pdf, /FALL OF WICKETS/);
  assert.match(pdf, /\/Count 1/);
});

test('web export downloads the generated PDF blob with a descriptive filename', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let clicked = false;
  let appended = false;
  let capturedBlob;
  let capturedFilename;
  URL.createObjectURL = blob => { capturedBlob = blob; return 'blob:scorecard'; };
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    createElement: () => ({
      style: {}, href: '', download: '', click() { clicked = true; capturedFilename = this.download; }, remove() {},
    }),
    body: { appendChild() { appended = true; } },
  };
  globalThis.window = { setTimeout() {} };
  try {
    const returnedName = downloadScorecardPdfWeb(sampleMatch());
    assert.equal(returnedName, 'Tigers_vs_Rangers_Scorecard.pdf');
    assert.equal(capturedFilename, returnedName);
    assert.equal(capturedBlob.type, 'application/pdf');
    assert.equal(clicked, true);
    assert.equal(appended, true);
    assert.ok(capturedBlob.size > 500);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('native PDF workflow writes returned PDF data into app cache before sharing', async () => {
  const calls = [];
  const sharedUri = await runNativePdfWorkflow('<h1>Both innings</h1>', 'Tigers_vs_Rangers_Scorecard.pdf', {
    async print(html) { calls.push(['print', html]); return { uri: 'file:///cache/print.pdf', base64: 'JVBERi0xLjQ=' }; },
    async persist(base64, filename) { calls.push(['persist', base64, filename]); return 'file:///app/cache/scorecards/Tigers_vs_Rangers_Scorecard.pdf'; },
    async canShare() { calls.push(['canShare']); return true; },
    async share(uri) { calls.push(['share', uri]); },
  });
  assert.equal(sharedUri, 'file:///app/cache/scorecards/Tigers_vs_Rangers_Scorecard.pdf');
  assert.deepEqual(calls.map(call => call[0]), ['print', 'persist', 'canShare', 'share']);
  assert.deepEqual(calls[1], ['persist', 'JVBERi0xLjQ=', 'Tigers_vs_Rangers_Scorecard.pdf']);
  assert.deepEqual(calls[3], ['share', sharedUri]);
});
