import type { MatchDetails, Scorecard } from '../types/api';

type Innings = MatchDetails['innings'][number];

function isBatsmanEvent(event: Innings['ballEvents'][number], player: Scorecard['batting'][number]) {
  return event.batsmanId ? event.batsmanId === player.id : event.batsmanName === player.name;
}

/** Adds PDF-only figures derived from the full local event log. */
export function scorecardPdfStats(innings: Innings) {
  const events = innings.ballEvents;
  const batting = innings.scorecard.batting.map(player => {
    // A no-ball is not a legal delivery, but the striker has faced a ball.
    const noBallsFaced = events.filter(event => event.eventType === 'NO_BALL' && isBatsmanEvent(event, player)).length;
    const balls = player.balls + noBallsFaced;
    return { ...player, balls, strikeRate: balls ? Number((player.runs * 100 / balls).toFixed(2)) : null };
  });

  const overTotals = new Map<string, { bowler: string; legalBalls: number; runs: number }>();
  for (const event of events) {
    const key = `${event.overNumber}:${event.bowlerName}`;
    const over = overTotals.get(key) ?? { bowler: event.bowlerName, legalBalls: 0, runs: 0 };
    const illegal = event.eventType === 'WIDE' || event.eventType === 'NO_BALL';
    if (!illegal) over.legalBalls++;
    // The current local scorer supports wides/no-balls only; both are charged
    // to the bowler. Future bye/leg-bye events must not be charged here.
    if (event.eventType !== 'BYE' && event.eventType !== 'LEG_BYE') over.runs += event.runs;
    overTotals.set(key, over);
  }
  const maidens = new Map<string, number>();
  if (events.length) {
    for (const over of overTotals.values()) {
      if (over.legalBalls === 6 && over.runs === 0) maidens.set(over.bowler, (maidens.get(over.bowler) ?? 0) + 1);
    }
  }
  const bowling = innings.scorecard.bowling.map(player => ({
    ...player,
    maidens: events.length ? maidens.get(player.name) ?? 0 : null,
  }));
  return { batting, bowling };
}
