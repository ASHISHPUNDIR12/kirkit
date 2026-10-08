import type { Match, ScoreboardInnings } from '../types/api.ts';

export type LocalMatch = Omit<Match, 'team1Id' | 'team2Id'> & ScoreboardInnings['match'] & {
  battingFirstTeam: string | null;
  tossWinner: string | null;
  tossDecision: 'BAT' | 'BOWL' | null;
  updatedAt: string;
};
export type LocalPlayer = ScoreboardInnings['players'][number] & {
  inningsId: string;
  playerId: string | null;
};
export type LocalBall = ScoreboardInnings['ballEvents'][number] & {
  inningsId: string;
  batsmanId: string | null;
  nonStrikerName: string | null;
  createdAt: string;
};
export type LocalInnings = Omit<ScoreboardInnings, 'match' | 'canUndo' | 'undoLabel' | 'players' | 'ballEvents'> & {
  matchId: string;
  players: LocalPlayer[];
  ballEvents: LocalBall[];
};
export type MatchState = { match: LocalMatch; innings: LocalInnings[] };
export type ActionKind = 'SCORE' | 'WICKET' | 'WIDE' | 'NO_BALL' | 'CHANGE_BOWLER' | 'NEW_BATSMAN' | 'END_INNINGS';
export type ScoringAction = { kind: ActionKind; runs?: number; playerName?: string };
export type IdFactory = () => string;
export type Command = { requestId: string; revision?: number };
export type UndoSnapshot = {
  innings: Omit<LocalInnings, 'id' | 'matchId' | 'inningsNumber' | 'battingTeamName' | 'bowlingTeamName' | 'players' | 'ballEvents'>;
  match: Pick<LocalMatch, 'status' | 'currentInnings' | 'firstInningsRuns' | 'firstInningsWickets' | 'target' | 'winner' | 'result'>;
  players: LocalPlayer[];
  sequence: number;
};
export type StoredAction = {
  id: string; matchId: string; inningsId: string; requestId: string; fingerprint: string;
  kind: string; revision: number; snapshot: string | null; undoneAt: string | null; createdAt: string;
};
