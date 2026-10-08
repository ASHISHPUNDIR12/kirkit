type Player = { id: string; playerName: string; playerType: string; runs: number; ballsFaced: number; ballsBowled: number; runsConceded: number; wicketsTaken: number; isOut: boolean };
type Event = { sequence: number; overNumber: number; ballNumber: number; runs: number; eventType: string; batsmanName: string; batsmanId?: string | null; nonStrikerName?: string | null };
const rate = (runs: number, balls: number, factor: number) => balls ? Number((runs * factor / balls).toFixed(2)) : null;
export function calculateScorecard(innings: { players: Player[]; ballEvents: Event[]; status: string }) {
  const events = [...innings.ballEvents].sort((a, b) => a.sequence - b.sequence);
  const extras = { wides: 0, noBalls: 0, total: 0 };
  const overs: { over: number; runs: number; wickets: number; legalBalls: number; extras: number; totalRuns: number; totalWickets: number }[] = [];
  const fallOfWickets: { wicket: number; runs: number; overs: string; playerName: string }[] = [];
  const partnerships: { wicket: number; players: string[]; runs: number; balls: number; ended: boolean }[] = [];
  let totalRuns = 0, wickets = 0, legalBalls = 0;
  let partnership = { wicket: 1, players: [] as string[], runs: 0, balls: 0, ended: false };
  for (const event of events) {
    const extra = event.eventType === 'WIDE' || event.eventType === 'NO_BALL';
    if (event.eventType === 'WIDE') extras.wides += event.runs;
    if (event.eventType === 'NO_BALL') extras.noBalls += event.runs;
    if (extra) extras.total += event.runs;
    totalRuns += event.runs;
    legalBalls += Number(!extra);
    if (event.eventType === 'WICKET') wickets++;
    let over = overs[overs.length - 1];
    if (!over || over.over !== event.overNumber) { over = { over: event.overNumber, runs: 0, wickets: 0, legalBalls: 0, extras: 0, totalRuns: 0, totalWickets: 0 }; overs.push(over); }
    over.runs += event.runs; over.legalBalls += Number(!extra); over.wickets += Number(event.eventType === 'WICKET');
    over.extras += extra ? event.runs : 0; over.totalRuns = totalRuns; over.totalWickets = wickets;
    partnership.runs += event.runs; partnership.balls += Number(!extra);
    for (const name of [event.batsmanName, event.nonStrikerName]) if (name && !partnership.players.includes(name)) partnership.players.push(name);
    if (event.eventType === 'WICKET') {
      fallOfWickets.push({ wicket: wickets, runs: totalRuns, overs: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`, playerName: event.batsmanName });
      partnership.ended = true; partnerships.push(partnership);
      partnership = { wicket: wickets + 1, players: [], runs: 0, balls: 0, ended: false };
    }
  }
  if (partnership.players.length) partnerships.push(partnership);
  return {
    extras, overs, fallOfWickets, partnerships,
    runRate: rate(totalRuns, legalBalls, 6),
    batting: innings.players.filter(p => p.playerType === 'BATSMAN').map(p => ({
      id: p.id, name: p.playerName, runs: p.runs, balls: p.ballsFaced, isOut: p.isOut,
      strikeRate: rate(p.runs, p.ballsFaced, 100),
      fours: events.filter(e => (e.batsmanId ? e.batsmanId === p.id : e.batsmanName === p.playerName) && e.eventType === 'FOUR').length,
      sixes: events.filter(e => (e.batsmanId ? e.batsmanId === p.id : e.batsmanName === p.playerName) && e.eventType === 'SIX').length,
    })),
    bowling: innings.players.filter(p => p.playerType === 'BOWLER').map(p => ({
      id: p.id, name: p.playerName, runs: p.runsConceded, wickets: p.wicketsTaken,
      overs: `${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`, economy: rate(p.runsConceded, p.ballsBowled, 6),
    })),
  };
}
