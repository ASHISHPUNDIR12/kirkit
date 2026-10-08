import type { SqlConnection } from './types.ts';

// Append migrations; never edit a released migration or recreate a user's database.
export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE teams (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, nameKey TEXT NOT NULL UNIQUE
      );
      CREATE TABLE players (
        id TEXT PRIMARY KEY NOT NULL, teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
        name TEXT NOT NULL, nameKey TEXT NOT NULL, UNIQUE(teamId, nameKey)
      );
      CREATE TABLE matches (
        id TEXT PRIMARY KEY NOT NULL,
        team1Id TEXT REFERENCES teams(id) ON DELETE RESTRICT,
        team2Id TEXT REFERENCES teams(id) ON DELETE RESTRICT,
        team1Name TEXT NOT NULL, team2Name TEXT NOT NULL,
        oversLimit INTEGER NOT NULL CHECK(oversLimit BETWEEN 1 AND 2147483647),
        battingFirstTeam TEXT, tossWinner TEXT, tossDecision TEXT CHECK(tossDecision IN ('BAT','BOWL')),
        currentInnings INTEGER NOT NULL DEFAULT 1 CHECK(currentInnings IN (1,2)),
        status TEXT NOT NULL CHECK(status IN ('CREATED','IN_PROGRESS','COMPLETED')),
        firstInningsRuns INTEGER, firstInningsWickets INTEGER, target INTEGER,
        winner TEXT, result TEXT, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE INDEX matches_date ON matches(createdAt DESC, id);
      CREATE TABLE innings (
        id TEXT PRIMARY KEY NOT NULL, matchId TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
        inningsNumber INTEGER NOT NULL CHECK(inningsNumber IN (1,2)),
        battingTeamName TEXT NOT NULL, bowlingTeamName TEXT NOT NULL,
        runs INTEGER NOT NULL CHECK(runs >= 0), wickets INTEGER NOT NULL CHECK(wickets BETWEEN 0 AND 10),
        completedOvers INTEGER NOT NULL CHECK(completedOvers >= 0),
        ballsInCurrentOver INTEGER NOT NULL CHECK(ballsInCurrentOver BETWEEN 0 AND 5),
        pendingBatsmanRole TEXT CHECK(pendingBatsmanRole IN ('STRIKER','NON_STRIKER')),
        status TEXT NOT NULL CHECK(status IN ('IN_PROGRESS','COMPLETED')),
        UNIQUE(matchId, inningsNumber)
      );
      CREATE TABLE player_innings (
        id TEXT PRIMARY KEY NOT NULL, inningsId TEXT NOT NULL REFERENCES innings(id) ON DELETE RESTRICT,
        playerId TEXT REFERENCES players(id) ON DELETE RESTRICT, playerName TEXT NOT NULL,
        playerType TEXT NOT NULL CHECK(playerType IN ('BATSMAN','BOWLER')),
        activeRole TEXT CHECK(activeRole IN ('STRIKER','NON_STRIKER','BOWLER')),
        runs INTEGER NOT NULL CHECK(runs >= 0), ballsFaced INTEGER NOT NULL CHECK(ballsFaced >= 0),
        runsConceded INTEGER NOT NULL CHECK(runsConceded >= 0), ballsBowled INTEGER NOT NULL CHECK(ballsBowled >= 0),
        wicketsTaken INTEGER NOT NULL CHECK(wicketsTaken >= 0), isOut INTEGER NOT NULL CHECK(isOut IN (0,1))
      );
      CREATE INDEX player_innings_innings ON player_innings(inningsId);
      CREATE INDEX player_innings_player ON player_innings(playerId);
      CREATE TABLE ball_events (
        id TEXT PRIMARY KEY NOT NULL, inningsId TEXT NOT NULL REFERENCES innings(id) ON DELETE RESTRICT,
        sequence INTEGER NOT NULL CHECK(sequence > 0), overNumber INTEGER NOT NULL CHECK(overNumber > 0),
        ballNumber INTEGER NOT NULL CHECK(ballNumber BETWEEN 1 AND 6),
        batsmanId TEXT, batsmanName TEXT NOT NULL, nonStrikerName TEXT, bowlerName TEXT NOT NULL,
        runs INTEGER NOT NULL CHECK(runs >= 0),
        eventType TEXT NOT NULL CHECK(eventType IN ('DOT','ONE','TWO','THREE','FOUR','SIX','WICKET','WIDE','NO_BALL')),
        createdAt TEXT NOT NULL, UNIQUE(inningsId, sequence)
      );
      CREATE TABLE match_actions (
        id TEXT PRIMARY KEY NOT NULL, matchId TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
        inningsId TEXT NOT NULL REFERENCES innings(id) ON DELETE RESTRICT,
        requestId TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
        revision INTEGER NOT NULL, snapshot TEXT, undoneAt TEXT, createdAt TEXT NOT NULL,
        UNIQUE(matchId, requestId), UNIQUE(matchId, revision)
      );
      CREATE INDEX actions_latest ON match_actions(matchId, revision DESC);
      CREATE TABLE imports (sourceId TEXT PRIMARY KEY NOT NULL, importedAt TEXT NOT NULL);
    `,
  },
] as const;

/** Must run inside a transaction, before the database is exposed to any screen. */
export async function migrate(tx: SqlConnection, ownerId: string) {
  const current = (await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (current > migrations[migrations.length - 1].version) {
    throw new Error('This database was saved by a newer app. Update Kirkit to open it.');
  }
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await tx.execAsync(migration.sql);
    await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
  const owner = await tx.getFirstAsync<{ value: string }>("SELECT value FROM metadata WHERE key = 'ownerId'");
  if (owner && owner.value !== ownerId) throw new Error('This database belongs to another account.');
  if (!owner) await tx.runAsync("INSERT INTO metadata(key,value) VALUES ('ownerId', ?)", ownerId);
}
