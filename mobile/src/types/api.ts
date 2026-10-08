export type HealthResponse = {
  status: "ok" | "error";
  database: "connected" | "unavailable";
};

export type CreateMatchInput = {
  team1Id?: string | null;
  team2Id?: string | null;
  team1Name: string;
  team2Name: string;
  oversLimit: number;
};

export type Match = CreateMatchInput & {
  id: string;
  battingFirstTeam: string | null;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
  result: string | null;
  tossWinner?: string | null;
  tossDecision?: 'BAT' | 'BOWL' | null;
};

export type StartMatchInput = {
  battingFirstTeam: string;
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
};
export type ExtraEventType = "WIDE" | "NO_BALL";

export type StartedMatch = Match & {
  currentInnings: number;
  innings: { id: string; inningsNumber: number }[];
};

export type ScoreboardInnings = {
  canUndo: boolean;
  undoLabel: string | null;
  id: string;
  inningsNumber: number;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  completedOvers: number;
  ballsInCurrentOver: number;
  pendingBatsmanRole: "STRIKER" | "NON_STRIKER" | null;
  status: "IN_PROGRESS" | "COMPLETED";
  players: {
    id: string;
    playerName: string;
    playerType: "BATSMAN" | "BOWLER";
    activeRole: "STRIKER" | "NON_STRIKER" | "BOWLER" | null;
    runs: number;
    ballsFaced: number;
    runsConceded: number;
    ballsBowled: number;
    wicketsTaken: number;
    isOut: boolean;
  }[];
  ballEvents: {
    id: string;
    sequence: number;
    overNumber: number;
    ballNumber: number;
    batsmanName: string;
    bowlerName: string;
    batsmanId?: string | null;
    nonStrikerName?: string | null;
    runs: number;
    eventType: string;
  }[];
  match: {
    id: string;
    revision: number;
    team1Id: string | null;
    team2Id: string | null;
    team1Name: string;
    team2Name: string;
    oversLimit: number;
    currentInnings: number;
    status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
    firstInningsRuns: number | null;
    firstInningsWickets: number | null;
    target: number | null;
    winner: string | null;
    result: string | null;
  };
};

export type MatchDetails = Match & {
  currentInnings: number;
  firstInningsRuns: number | null;
  firstInningsWickets: number | null;
  target: number | null;
  winner: string | null;
  innings: {
    id: string;
    inningsNumber: number;
    battingTeamName: string;
    bowlingTeamName: string;
    runs: number;
    wickets: number;
    completedOvers: number;
    ballsInCurrentOver: number;
    status: "IN_PROGRESS" | "COMPLETED";
    scorecard: Scorecard;
    players: ScoreboardInnings["players"];
    ballEvents: ScoreboardInnings["ballEvents"];
  }[];
};

export type Team = { id: string; name: string; players: SavedPlayer[] };
export type SavedPlayer = { id: string; name: string; stats: {
  matches: number; runs: number; ballsFaced: number; wickets: number;
  ballsBowled: number; runsConceded: number; strikeRate: number | null; economy: number | null; average: number | null;
} };
export type Scorecard = {
  extras: { wides: number; noBalls: number; total: number };
  runRate: number | null;
  batting: { id: string; name: string; runs: number; balls: number; isOut: boolean; strikeRate: number | null; fours: number; sixes: number }[];
  bowling: { id: string; name: string; runs: number; wickets: number; overs: string; economy: number | null }[];
  overs: { over: number; runs: number; wickets: number; legalBalls: number; extras: number; totalRuns: number; totalWickets: number }[];
  fallOfWickets: { wicket: number; runs: number; overs: string; playerName: string }[];
  partnerships: { wicket: number; players: string[]; runs: number; balls: number; ended: boolean }[];
};
