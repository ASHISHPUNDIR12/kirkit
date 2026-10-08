export type HealthResponse = {
  status: "ok" | "error";
  database: "connected" | "unavailable";
};

export type CreateMatchInput = {
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
    runs: number;
    eventType: string;
  }[];
  match: {
    id: string;
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
    players: ScoreboardInnings["players"];
    ballEvents: ScoreboardInnings["ballEvents"];
  }[];
};
