import type { MatchDetails } from '../types/api';
import { scorecardPdfStats } from './scorecardStats.ts';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const oversText = (overs: number, balls: number) => `${overs}.${balls}`;
const eventLabel: Record<string, string> = {
  DOT: 'Dot', ONE: '1 run', TWO: '2 runs', THREE: '3 runs', FOUR: 'Four', SIX: 'Six',
  WICKET: 'Wicket', WIDE: 'Wide', NO_BALL: 'No-ball', BYE: 'Bye', LEG_BYE: 'Leg-bye',
};

function renderInnings(inning: MatchDetails['innings'][number]) {
  const card = inning.scorecard;
  const stats = scorecardPdfStats(inning);
  const overs = oversText(inning.completedOvers, inning.ballsInCurrentOver);
  const battingRows = stats.batting.length
    ? stats.batting.map(player => `<tr><td class="player"><strong>${escapeHtml(player.name)}</strong><small>${player.isOut ? 'Out (dismissal detail not recorded)' : 'not out'}</small></td><td>${player.runs}</td><td>${player.balls}</td><td>${player.fours}</td><td>${player.sixes}</td><td>${player.strikeRate ?? '—'}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="6">No batting entries recorded.</td></tr>';
  const bowlingRows = stats.bowling.length
    ? stats.bowling.map(player => `<tr><td class="player"><strong>${escapeHtml(player.name)}</strong></td><td>${player.overs}</td><td>${player.maidens ?? '—'}</td><td>${player.runs}</td><td>${player.wickets}</td><td>${player.economy ?? '—'}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="6">No bowling entries recorded.</td></tr>';

  // Only show fall of wickets when every saved wicket event is represented by
  // the source scorecard calculation. Dismissal type/fielder are not in v1.
  const events = [...inning.ballEvents].sort((a, b) => a.sequence - b.sequence);
  const wicketEvents = events.filter(event => event.eventType === 'WICKET');
  const fowIsReliable = wicketEvents.length === inning.wickets && card.fallOfWickets.length === inning.wickets;
  const fallRows = fowIsReliable && card.fallOfWickets.length
    ? card.fallOfWickets.map((wicket, index) => {
      const event = wicketEvents[index];
      const over = event.ballNumber === 6 ? `${event.overNumber}.0` : `${event.overNumber}.${event.ballNumber}`;
      return `<tr><td class="player">${escapeHtml(wicket.playerName)}</td><td>${wicket.runs}/${wicket.wicket}</td><td>${over}</td></tr>`;
    }).join('')
    : '';
  const fallSection = fallRows
    ? `<h3>Fall of wickets</h3><table class="compact"><colgroup><col class="player-col"><col><col></colgroup><thead><tr><th>Batsman</th><th>Score</th><th>Over</th></tr></thead><tbody>${fallRows}</tbody></table>`
    : fowIsReliable
      ? '<h3>Fall of wickets</h3><p class="quiet">No wickets recorded.</p>'
      : inning.wickets > 0
        ? '<h3>Fall of wickets</h3><p class="quiet">Unavailable: saved delivery data does not contain every wicket.</p>'
        : '';

  const status = inning.status === 'COMPLETED' ? 'Innings complete' : 'In progress';
  const extras = [`Wides ${card.extras.wides}`, `No-balls ${card.extras.noBalls}`].join(' · ');
  const eventRows = events.map(event => `<tr><td>${event.overNumber}.${event.ballNumber}</td><td>${escapeHtml(event.bowlerName)}</td><td>${escapeHtml(event.batsmanName)}</td><td>${eventLabel[event.eventType] ?? escapeHtml(event.eventType)}</td><td>${event.runs}</td></tr>`).join('');

  return `<section class="innings">
    <div class="innings-heading"><span>${escapeHtml(inning.battingTeamName)}</span><strong>${inning.runs}-${inning.wickets} <small>(${overs})</small></strong></div>
    <p class="innings-meta">${inning.inningsNumber === 1 ? 'First innings' : inning.inningsNumber === 2 ? 'Second innings' : `Innings ${inning.inningsNumber}`} · ${escapeHtml(inning.bowlingTeamName)} bowling · ${status}</p>
    <h3>Batting</h3><table><colgroup><col class="player-col"><col><col><col><col><col></colgroup><thead><tr><th>Batsman</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${battingRows}</tbody></table>
    <div class="innings-total"><span>Extras <small>(${extras})</small></span><strong>${inning.runs}-${inning.wickets} <small>(${overs} overs)</small></strong><span>Run rate <b>${card.runRate ?? '—'}</b></span></div>
    <h3>Bowling</h3><table><colgroup><col class="player-col"><col><col><col><col><col></colgroup><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ER</th></tr></thead><tbody>${bowlingRows}</tbody></table>
    ${fallSection}
    ${eventRows ? `<div class="deliveries"><h3>Ball-by-ball details</h3><table><thead><tr><th>Over</th><th>Bowler</th><th>Batsman</th><th>Event</th><th>Runs</th></tr></thead><tbody>${eventRows}</tbody></table></div>` : ''}
  </section>`;
}

export function scorecardHtml(match: MatchDetails): string {
  const innings = [...match.innings].sort((a, b) => a.inningsNumber - b.inningsNumber);
  const dateValue = new Date(match.createdAt);
  const date = Number.isNaN(dateValue.valueOf()) ? 'Date unavailable' : dateValue.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const toss = match.tossWinner && match.tossDecision
    ? `${escapeHtml(match.tossWinner)} won toss, chose to ${match.tossDecision === 'BAT' ? 'bat' : 'bowl'}`
    : 'Toss not recorded';
  const scores = innings.length
    ? innings.map(inning => `<span><b>${escapeHtml(inning.battingTeamName)}</b> ${inning.runs}-${inning.wickets} (${oversText(inning.completedOvers, inning.ballsInCurrentOver)})</span>`).join('<i>·</i>')
    : '<span>Innings have not started</span>';
  const result = match.result
    ? escapeHtml(match.result)
    : match.winner
      ? `${escapeHtml(match.winner)} won`
      : match.status === 'COMPLETED' ? 'Match completed' : 'Match in progress';
  const inningsHtml = innings.map(renderInnings).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @page{size:A4 portrait;margin:12mm 12mm 13mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#17231d;font-size:8.5pt;line-height:1.28;margin:0}header{text-align:center;padding:0 0 8px;border-bottom:1px solid #aab7ad;margin-bottom:10px}.brand{font-weight:800;font-size:7pt;letter-spacing:.16em;color:#56685c;margin-bottom:5px}h1{font-size:17pt;line-height:1.15;margin:0 0 3px;font-weight:700}.result{font-size:9pt;font-weight:700;margin:0 0 4px}.meta{font-size:7.5pt;color:#56645b}.scores{display:flex;justify-content:center;flex-wrap:wrap;gap:5px;margin-top:6px;font-size:7.5pt}.scores i{font-style:normal;color:#7b887e}.innings{margin:12px 0 0}.innings-heading{background:#174d35;color:#fff;padding:6px 9px;display:flex;justify-content:space-between;align-items:center;font-size:10pt;font-weight:700;break-after:avoid-page;page-break-after:avoid}.innings-heading strong{font-size:10pt}.innings-heading small{font-size:8pt;font-weight:400;color:#fff}.innings-meta{color:#68766d;font-size:7pt;margin:3px 1px 5px}h3{font-size:7.5pt;line-height:1.1;text-transform:uppercase;letter-spacing:.07em;margin:9px 0 3px;break-after:avoid-page;page-break-after:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7.7pt;margin:0 0 4px}thead{display:table-header-group}tr{break-inside:avoid-page;page-break-inside:avoid}th{background:#e4f0e5;color:#33483a;font-size:7pt;font-weight:700;padding:4px 4px;text-align:right}td{padding:4px;border-bottom:1px solid #dfe5df;text-align:right}th:first-child,td:first-child{text-align:left}.player-col{width:43%}.player{overflow-wrap:anywhere}.player strong{font-weight:700}.player small{display:block;color:#6b786e;font-size:6.6pt;font-weight:400}.empty{text-align:left;color:#68766d}.innings-total{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid #ccd7ce;border-bottom:1px solid #ccd7ce;padding:5px 4px;margin:3px 0 5px;font-size:7.5pt}.innings-total>span:first-child{flex:1}.innings-total>strong{font-size:9pt;white-space:nowrap}.innings-total small{font-size:6.8pt;font-weight:400;color:#68766d}.innings-total>span:last-child{white-space:nowrap}.compact{width:75%}.quiet{font-size:7pt;color:#68766d;margin:2px 0 4px}.deliveries{margin-top:8px;font-size:7pt}.deliveries summary{color:#40594a}.deliveries table{margin-top:3px}.deliveries th,.deliveries td{padding:3px}.footer{margin-top:12px;padding-top:5px;border-top:1px solid #dfe5df;color:#718078;font-size:6.5pt;text-align:center}.innings-heading,h3{break-inside:avoid-page;page-break-inside:avoid}table{break-inside:auto;page-break-inside:auto}
    </style></head><body><header><div class="brand">KIRKIT</div><h1>${escapeHtml(match.team1Name)} v/s ${escapeHtml(match.team2Name)}</h1><p class="result">${result}</p><div class="meta">${escapeHtml(date)} · ${match.oversLimit} overs · ${toss}</div><div class="scores">${scores}</div></header>
    ${inningsHtml || '<p class="quiet">No innings have been recorded yet.</p>'}<footer class="footer">Generated offline from the saved Kirkit scorebook.</footer></body></html>`;
}
