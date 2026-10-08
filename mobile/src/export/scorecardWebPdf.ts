import type { MatchDetails } from '../types/api';
import { scorecardPdfStats } from './scorecardStats.ts';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 38;
const BOTTOM = 38;
const GREEN = [0.09, 0.30, 0.20] as const;
const LIGHT_GREEN = [0.89, 0.94, 0.89] as const;

function pdfText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-').replace(/[·•]/g, '|').replace(/[^\x20-\x7e]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

/** Creates a self-contained A4 PDF without a server or browser print dialog. */
export function createScorecardPdfBytes(match: MatchDetails): Uint8Array {
  const pageStreams: string[][] = [[]];
  let page = 0;
  let y = 0;
  const commands = () => pageStreams[page];
  const topY = (top: number) => PAGE_H - top;
  const newPage = () => { pageStreams.push([]); page++; y = MARGIN; };
  const ensure = (height: number) => { if (y + height > PAGE_H - BOTTOM) newPage(); };
  const text = (value: unknown, x: number, top: number, size = 9, bold = false, color = [0.09, 0.14, 0.11]) => {
    commands().push(`${color.join(' ')} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${topY(top).toFixed(2)} Td (${pdfText(value)}) Tj ET`);
  };
  const line = (x1: number, top1: number, x2: number, top2: number, color = [0.78, 0.82, 0.78], width = 0.6) => {
    commands().push(`${color.join(' ')} RG ${width} w ${x1} ${topY(top1)} m ${x2} ${topY(top2)} l S`);
  };
  const rect = (x: number, top: number, width: number, height: number, color: readonly number[]) => {
    commands().push(`${color.join(' ')} rg ${x} ${topY(top + height)} ${width} ${height} re f`);
  };
  const rightText = (value: unknown, right: number, top: number, size = 8, bold = false) => {
    const str = pdfText(value);
    text(str, right - str.length * size * (bold ? 0.56 : 0.51), top, size, bold);
  };
  const section = (title: string) => {
    ensure(36);
    y += 9;
    text(title.toUpperCase(), MARGIN, y + 9, 8, true, [0.22, 0.31, 0.25]);
    y += 15;
  };
  const table = (headers: string[], rows: string[][], opts: { firstWidth?: number; rowHeights?: number[]; rightCols?: number[] } = {}) => {
    const width = PAGE_W - MARGIN * 2;
    const firstWidth = opts.firstWidth ?? width * 0.43;
    const otherWidth = (width - firstWidth) / (headers.length - 1);
    const xAt = (column: number) => MARGIN + (column === 0 ? 0 : firstWidth + otherWidth * (column - 1));
    const colW = (column: number) => column === 0 ? firstWidth : otherWidth;
    ensure(18 + (opts.rowHeights?.[0] ?? 18));
    const drawHeader = () => {
      rect(MARGIN, y, width, 18, LIGHT_GREEN);
      headers.forEach((heading, index) => {
        const x = xAt(index) + 4;
        if (index === 0) text(heading, x, y + 12, 7, true, [0.20, 0.29, 0.23]);
        else rightText(heading, xAt(index) + colW(index) - 4, y + 12, 7, true);
      });
      y += 18;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const height = opts.rowHeights?.[rowIndex] ?? 18;
      if (y + height > PAGE_H - BOTTOM) { newPage(); drawHeader(); }
      row.forEach((value, index) => {
        if (index === 0) text(value, xAt(index) + 4, y + 12, 8);
        else rightText(value, xAt(index) + colW(index) - 4, y + 12, 8);
      });
      y += height;
      line(MARGIN, y, PAGE_W - MARGIN, y);
    });
    y += 3;
  };

  text('KIRKIT', MARGIN, y + 8, 8, true, [0.30, 0.39, 0.33]);
  y += 18;
  text(`${match.team1Name} v/s ${match.team2Name}`, MARGIN, y + 18, 18, true);
  y += 26;
  const result = match.result ?? (match.winner ? `${match.winner} won` : match.status === 'COMPLETED' ? 'Match completed' : 'Match in progress');
  text(result, MARGIN, y + 10, 10, true);
  y += 18;
  const dateValue = new Date(match.createdAt);
  const date = Number.isNaN(dateValue.valueOf()) ? 'Date unavailable' : dateValue.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const toss = match.tossWinner && match.tossDecision ? `${match.tossWinner} won toss, chose to ${match.tossDecision === 'BAT' ? 'bat' : 'bowl'}` : 'Toss not recorded';
  text(`${date} | ${match.oversLimit} overs | ${toss}`, MARGIN, y + 8, 7);
  y += 18;
  const sortedInnings = [...match.innings].sort((a, b) => a.inningsNumber - b.inningsNumber);
  sortedInnings.forEach((inning, index) => {
    if (index) y += 8;
    ensure(44);
    rect(MARGIN, y, PAGE_W - MARGIN * 2, 24, GREEN);
    text(inning.battingTeamName, MARGIN + 8, y + 16, 10, true, [1, 1, 1]);
    const overText = `${inning.completedOvers}.${inning.ballsInCurrentOver}`;
    rightText(`${inning.runs}-${inning.wickets} (${overText})`, PAGE_W - MARGIN - 8, y + 16, 10, true);
    y += 31;
    text(`${index === 0 ? 'First' : index === 1 ? 'Second' : `Innings ${inning.inningsNumber}`} innings | ${inning.bowlingTeamName} bowling`, MARGIN, y + 7, 7, false, [0.40, 0.46, 0.42]);
    y += 9;

    const stats = scorecardPdfStats(inning);
    section('Batting');
    const batting = stats.batting.length
      ? stats.batting.map(player => [`${player.name} - ${player.isOut ? 'Out (dismissal detail not recorded)' : 'not out'}`, String(player.runs), String(player.balls), String(player.fours), String(player.sixes), String(player.strikeRate ?? '-')])
      : [['No batting entries recorded.', '', '', '', '', '']];
    table(['Batsman', 'R', 'B', '4s', '6s', 'SR'], batting, { firstWidth: 254 });
    ensure(26);
    text(`Extras: Wides ${inning.scorecard.extras.wides} | No-balls ${inning.scorecard.extras.noBalls}`, MARGIN, y + 10, 8, true);
    rightText(`Total ${inning.runs}-${inning.wickets} (${overText}) | RR ${inning.scorecard.runRate ?? '-'}`, PAGE_W - MARGIN, y + 10, 8, true);
    y += 17;

    section('Bowling');
    const bowling = stats.bowling.length
      ? stats.bowling.map(player => [player.name, player.overs, String(player.maidens ?? '-'), String(player.runs), String(player.wickets), String(player.economy ?? '-')])
      : [['No bowling entries recorded.', '', '', '', '', '']];
    table(['Bowler', 'O', 'M', 'R', 'W', 'ER'], bowling, { firstWidth: 254 });

    const events = [...inning.ballEvents].sort((a, b) => a.sequence - b.sequence);
    const wicketEvents = events.filter(event => event.eventType === 'WICKET');
    const fowIsReliable = wicketEvents.length === inning.wickets && inning.scorecard.fallOfWickets.length === inning.wickets;
    if (fowIsReliable) {
      section('Fall of wickets');
      const fallRows = inning.scorecard.fallOfWickets.map((wicket, wicketIndex) => {
        const event = wicketEvents[wicketIndex];
        const over = event.ballNumber === 6 ? `${event.overNumber}.0` : `${event.overNumber}.${event.ballNumber}`;
        return [wicket.playerName, `${wicket.runs}/${wicket.wicket}`, over];
      });
      table(['Batsman', 'Score', 'Over'], fallRows.length ? fallRows : [['No wickets recorded.', '', '']], { firstWidth: 254 });
    } else if (inning.wickets > 0) {
      section('Fall of wickets');
      text('Unavailable: saved delivery data does not contain every wicket.', MARGIN, y + 8, 7);
      y += 13;
    }

    if (events.length) {
      section('Ball-by-ball details');
      const labels: Record<string, string> = { DOT: 'Dot', ONE: '1 run', TWO: '2 runs', THREE: '3 runs', FOUR: 'Four', SIX: 'Six', WICKET: 'Wicket', WIDE: 'Wide', NO_BALL: 'No-ball', BYE: 'Bye', LEG_BYE: 'Leg-bye' };
      const deliveryRows = events.map(event => [`${event.overNumber}.${event.ballNumber}`, event.bowlerName, event.batsmanName, labels[event.eventType] ?? event.eventType, String(event.runs)]);
      table(['Over', 'Bowler', 'Batsman', 'Event', 'Runs'], deliveryRows, { firstWidth: 70 });
    }
  });

  const objects: string[] = [];
  const pageCount = pageStreams.length;
  const pagesRootId = 2;
  const fontRegularId = 3 + pageCount * 2;
  const fontBoldId = fontRegularId + 1;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageStreams.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  pageStreams.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const streamId = pageId + 1;
    const content = stream.join('\n');
    objects[pageId] = `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
  });
  objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let output = '%PDF-1.4\n%Kirkit\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = new TextEncoder().encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function downloadScorecardPdfWeb(match: MatchDetails): string {
  const bytes = createScorecardPdfBytes(match);
  const filename = `${safeFilePart(match.team1Name)}_vs_${safeFilePart(match.team2Name)}_Scorecard.pdf`;
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}

function safeFilePart(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'match';
}
