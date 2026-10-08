# Gully Cricket Score Tracker

All 12 milestones are complete: an Expo + React Native mobile app, TypeScript
Express backend, and PostgreSQL persistence for complete gully-cricket matches.
Email/password signup and login protect every match and innings endpoint.
See [deployment instructions](backend/DEPLOYMENT.md) for production setup,
authentication API details, and migration requirements.

## Scoring and roster features

Undo, duplicate-score protection, saved teams/players, career statistics and full
scorecards are implemented. Read the [feature and migration guide](docs/SCORING-FEATURES.md)
before starting the updated backend. Live sharing is not included.

## Requirements

- Node.js 24 LTS (Node.js 22.13+ also works).
- npm.
- Expo Go on your phone, or an Android emulator/iOS simulator.
- A PostgreSQL connection string in `backend/.env`.

## Folder structure

```text
mobile/
  src/
    app/           # Home, match setup, scoring, and match details screens
    components/    # Shared buttons, match cards, and scoring summaries
    services/      # HTTP requests
    types/         # API response types
  assets/          # Expo template icons
  app.json         # Expo app configuration
  .env.example     # Public backend address example

backend/
  src/
    app.ts         # Express middleware and routes
    server.ts      # Database check, server startup, shutdown
    routes/        # API route definitions
    controllers/   # Request handlers
    services/      # Database connection and match/scoring operations
    utils/         # Environment, input validation, and result calculations
    generated/     # Generated Prisma client (ignored)
  prisma/
    schema.prisma  # Match, Innings, PlayerInnings, BallEvent
    migrations/    # Versioned PostgreSQL schema changes
  prisma.config.ts # Prisma CLI configuration
  .env.example     # Backend environment variable example
```

Each project has its own `package.json`, lockfile, and TypeScript configuration.
The mobile project also has the Expo-generated `AGENTS.md`, ESLint configuration,
and Expo Router entry point.

## Start the backend

The provided database URL has already been saved locally in `backend/.env`.
For a fresh checkout, copy `.env.example` to `.env` and supply your own URL.
Environment files are ignored; keep database credentials on the backend.

```sh
cd backend
npm ci
npm run prisma:deploy
npm run prisma:generate
npm run dev
```

The backend reads `PORT` (default `3000`) and `DATABASE_URL` from `.env`.
It verifies the database with `SELECT 1` before listening on all interfaces.
Schema changes are applied separately using Prisma migrations.

`DATABASE_URL` is the pooled connection used by the backend. `DIRECT_URL` is an
optional direct connection used by the Prisma CLI; on Neon, its hostname omits
`-pooler`. The local direct URL includes a 30-second connection timeout for slow
connections. Both URLs are stored only in the ignored `backend/.env` file.

Check the API in another terminal:

```sh
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","database":"connected"}
```

`GET /health` returns HTTP 503 if the database becomes unavailable. It never
returns database credentials or internal database errors.

For a compiled backend:

```sh
npm run build
npm start
```

## Start the mobile app

In another terminal:

```sh
cd mobile
npm ci
npm start
```

Scan the QR code with Expo Go. Use an Expo Go version compatible with the app's
Expo SDK 57. You can also press `a` for an installed Android emulator, or `i` for
an iOS simulator on macOS. For a browser preview, run `npm run web`.

Home displays **Start New Match** and **Previous Matches**, loaded from the
database with the newest matches first. Tap **Start New Match**, enter two team
names and a custom over count, and tap **Create Match**. Then tap **Set Up First
Innings**, choose the batting team, enter the opening players, and tap **Start
First Innings**. On the scoreboard, record runs, wickets, wides, and no-balls.
Legal balls advance the over and rotate strike when required; a new-bowler
prompt appears at each over change. Finish the first innings to set a target
and set up the chase. The match ends with a saved result, visible from the
previous-match list.

Home reloads matches when you return to it. Use **Refresh** to fetch changes, or
**Try again** after a connection error. The existing **Check connection** button
is available at the bottom. HTTP requests live in `src/services/api.ts`.

Before first-innings setup, a match has status `CREATED`. Starting it saves the
selected batting team, creates the first innings and its three player records,
and changes the status to `IN_PROGRESS` (shown as **In progress**). Ball scores,
delivery counts, and player statistics are saved as the match is played.

### Phone-sized preview on your laptop

Keep the backend and Expo running, then open
`http://localhost:8081/phone-preview.html` in your laptop browser. This displays
the live web app in a phone-sized frame. Tap **Check connection** inside it.
For this local preview, set `EXPO_PUBLIC_API_URL=http://localhost:3000` in
`mobile/.env` and restart Expo after changing the address. Temporary tunnel URLs
and their QR codes expire when the tunnel process stops; they should not be saved
as the default local backend address.

### Connect from a phone

For Windows + WSL2 + Expo Go, follow the [phone connectivity guide](docs/PHONE-CONNECTIVITY.md)
for scoped Windows forwarding/firewall commands, diagnostics, and an HTTPS backend tunnel.
Expo's `--tunnel` does not expose the Express backend.

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your computer's LAN address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Replace the example IP with your computer's actual address. The phone and computer
must be on the same Wi-Fi, and port 3000 must be reachable. On WSL, your phone must
reach the WSL backend (for example using mirrored networking or port forwarding).
`localhost` on a phone refers to the phone, not your computer. Restart Expo after
changing `.env`.

- Android emulator: `http://10.0.2.2:3000`
- iOS simulator or browser on the backend computer: `http://localhost:3000`

Only the public API address belongs in the mobile environment file. Never put
`DATABASE_URL` in the mobile project or an `EXPO_PUBLIC_` variable.

## Checks

```sh
cd backend
npm run prisma:validate
npm run typecheck
npm run build
npm test
npm run test:integration
```

```sh
cd mobile
npm run typecheck
npm run lint
npx expo install --check
```

## Milestone boundary

All 12 milestones are complete. The match flow includes wickets, extras,
first-innings completion, a target chase, results, and saved match details.

## Milestone 6 overs and bowler changes

Each supported score is a legal delivery. The innings increments
`ballsInCurrentOver`; after six balls it increments `completedOvers`, resets the
current-over count, and stores the next event at ball 1 of the next over. Strike
rotates for 1 or 3 runs and at over end. After an over, the active bowler role is
cleared, the scoreboard prompts for the next bowler, and scoring stays blocked
until the change is saved.

`POST /innings/:inningsId/change-bowler` accepts `{"playerName":"Aman"}` and
saves the new active bowler. Previous bowler records and their figures remain
stored. No database migration was needed.

Milestone 6 verification passed: backend TypeScript/build and tests, mobile
TypeScript/lint, and web bundle export. Database checks covered strike rotation,
the six-ball over boundary, next-over delivery numbering, blocking scores until
a bowler is changed, and saving the next bowler. A mobile-sized browser run
checked the over-complete prompt and scoring the next over.

## Milestones 7–8 wickets and extras

`POST /innings/:inningsId/wicket` records the striker's dismissal as a legal
ball, updates the wicket and bowler figures, and pauses scoring until a new
batsman is entered with `POST /innings/:inningsId/new-batsman`. The innings
stores the next batting role so a wicket on the last ball keeps the correct
ends. The additive `pendingBatsmanRole` field is in the
`20261007181851_wicket_replacement` migration.

`POST /innings/:inningsId/extra` accepts `{"eventType":"WIDE"}` or
`{"eventType":"NO_BALL"}`. Each adds one team and bowler run, creates an event,
and leaves legal ball and batter statistics unchanged.

## Milestones 9–10 innings setup and match result

`POST /innings/:inningsId/end` finishes an innings. Completing or ending the
first innings stores its score and sets `target = runs + 1`. The second innings
automatically bats the other team; `POST /matches/:matchId/start-second-innings`
stores its opening players. The scoreboard shows the target, runs required, and
legal balls remaining.

The chase finishes when the target is reached, the overs or wickets run out, or
the scorer ends the match with `POST /matches/:matchId/finish`. Results are
stored as a wicket margin, run margin, or tie. No delivery action is accepted
after an innings completes.

## Milestones 11–12 history and cleanup

`GET /matches/:matchId` returns a match, both innings, player figures, and
ball-event history. Previous-match cards open this detail screen, including the
saved final score and result. Scoring controls are a separate mobile component;
HTTP calls, request validation, and match/scoring database work remain in the
service and API layers.

## Milestone 5 scoring

`GET /innings/:inningsId` loads an innings and its scoreboard data.
`POST /innings/:inningsId/score` accepts `{"runs":0}`, where runs must be one of
0, 1, 2, 3, 4, or 6. Each accepted score atomically updates team runs, the active
striker's runs and balls faced, the active bowler's conceded runs and balls
bowled, and a `BallEvent` with the batsman and bowler names. The API returns the
updated innings for the screen to display. Invalid scores return HTTP 400;
missing innings return 404. No database migration was needed.

Milestone 5 verification passed: backend TypeScript/build, unit and database
integration tests, mobile TypeScript/lint, and web bundle export. Integration
checks verified the six supported scores, event order and delivery positions,
player totals, and scoreboard reload. A mobile-sized browser run completed
match creation, innings setup, scoring, and reload without browser runtime
errors.

## Milestone 4 innings setup

`POST /matches/:matchId/start` accepts `battingFirstTeam`, `strikerName`,
`nonStrikerName`, and `bowlerName`. It verifies the team belongs to that match,
then transactionally updates the match and creates innings 1 with the two
batsmen and opening bowler in their active roles. It returns the match with the
new innings and players. Invalid setup returns HTTP 400, a missing match returns
404, and a match that is already started returns 409. No schema change or
migration was needed.

Milestone 4 verification passed: backend TypeScript/build and tests, mobile
TypeScript/lint, and web bundle export. Database integration checks verified
the selected team, opposing bowling team, saved player names and roles, and
duplicate-start protection. A mobile-sized browser run completed match
creation and first-innings setup through the UI without runtime errors.

## Milestone 3 API

`GET /matches` returns an array of saved matches, newest first.

`POST /matches` accepts JSON:

```json
{"team1Name":"Tigers","team2Name":"Warriors","oversLimit":5}
```

It returns HTTP 201 with the saved match (including its generated ID, status,
and timestamps). Only those three input fields are accepted for persistence;
clients cannot set status, target, or results through this endpoint.

Names are trimmed, required, limited to 60 characters, and must differ ignoring
case. Overs must be a positive integer within PostgreSQL's integer range.
Invalid input or malformed JSON returns HTTP 400 with `{ "error": "..." }`.
Database failures return HTTP 503 with a user-readable message.

Routes call controllers for validation/HTTP responses, while `matchService.ts`
contains the Prisma queries. No additional libraries or migrations were needed.

`npm test` runs unit tests. `npm run test:integration` requires a separate
`TEST_DATABASE_URL` pointing to a disposable database and runs HTTP tests on an ephemeral local port. It writes
uniquely named fixtures, verifies persistence, ordering, and error responses,
then removes only its fixtures.

Milestone 3 verification passed: both TypeScript checks, mobile lint, backend
build, validation and database integration tests, and Android/iOS/web bundle
exports. A browser test at 390 × 844 checked validation, creation, confirmation,
returning Home, persistence after reload, connection checking, error/retry, and
the IDE phone-preview frame. Browser test data was removed afterward. Native
bundles were verified; this milestone was not tested on a physical phone.

## Milestone 2 database schema

| Model | Stores |
| --- | --- |
| `Match` | Team names, over limit, batting-first team, status, target, winner, and result text |
| `Innings` | Batting/bowling teams, innings number, team score, and legal delivery counters |
| `PlayerInnings` | Typed player names, batting/bowling statistics, dismissal flag, and active role |
| `BallEvent` | Each scoring action, player-name snapshots, delivery position, and event sequence |

A match has innings. Each innings has player records and ball events. Deleting a
match cascades to its innings, players, and events. There is no separate player
directory; a person may have separate batting and bowling records.

Match status starts as `CREATED`; innings status starts as `IN_PROGRESS`; all
score counters start at zero. `activeRole` can be `STRIKER`, `NON_STRIKER`, or
`BOWLER`, or null for an inactive player. Target and result fields remain null
until those stages are reached. Team-choice fields store the selected team name.

`inningsNumber` identifies innings 1 or 2, and cannot repeat within a match.
Ball events have a unique `sequence` within their innings, including extras.
`overNumber` and `ballNumber` use one-based delivery positions; extras can share
the next legal ball's position. Scoring rules and input validation will be
implemented in their later milestones.

Apply the saved migration and regenerate the client on a fresh database:

```sh
cd backend
npm run prisma:deploy
npm run prisma:generate
npm run prisma:status
```

For future approved schema changes, create a migration with
`npm run prisma:migrate -- --name describe_your_change`, then run
`npm run prisma:generate`. Migration files belong in version control;
generated client files do not.

Milestone 2 verification passed: the migration is applied, the database matches
the Prisma schema, and client generation, TypeScript checks, and the backend
build succeed. Database checks covered model relationships, zero/default values,
player updates, cascade deletion, unique innings/event ordering, and rejection
of orphan player records. All test records were rolled back. `/health` continues
to report a connected database.

Setup follows the official [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/)
and [Prisma 7 PostgreSQL setup](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

## Milestone 1 verification

Verified in this workspace:

- Prisma client generation and schema validation pass with no models.
- Backend TypeScript check and compiled build pass.
- Both development servers start successfully.
- `GET /health` returns HTTP 200 and confirms the provided PostgreSQL connection.
- The mobile API service successfully calls the live `/health` endpoint.
- Mobile TypeScript and ESLint checks pass.
- Expo dependency compatibility check passes.
- Android, iOS, and web production bundles export successfully.
- Expo's web page returns HTTP 200 and Metro reports `packager-status:running`.
- The mobile lockfile passes an `npm ci --dry-run` check.

The verification servers were stopped after checking them. No physical phone or
native simulator was available for an on-device UI check. The optional React
Native DevTools desktop window could not launch in this Linux environment because
`libnspr4.so` is absent; Metro and bundle exports still run successfully.

Database pool size and query/connection timeouts are configurable; see
`backend/.env.example`. The existing IPv4/IPv6 connection-racing workaround is
preserved for the project's WSL network (`setDefaultAutoSelectFamily(false)`).

## Created files

```text
.gitignore
README.md
backend/
  .env                         # Local credentials, ignored
  .env.example
  package.json
  package-lock.json
  tsconfig.json
  prisma.config.ts
  prisma/schema.prisma
  prisma/migrations/migration_lock.toml
  prisma/migrations/20261007165614_init_cricket/migration.sql
  prisma/migrations/20261007181851_wicket_replacement/migration.sql
  src/app.ts
  src/server.ts
  src/controllers/healthController.ts
  src/controllers/matchController.ts
  src/routes/healthRoutes.ts
  src/routes/matchRoutes.ts
  src/routes/inningsRoutes.ts
  src/services/database.ts
  src/services/matchService.ts
  src/services/scoringService.ts
  src/utils/env.ts
  src/utils/validateMatch.ts
  src/utils/validatePlayerName.ts
  src/utils/validateExtra.ts
  src/utils/validateSecondInnings.ts
  src/utils/calculateResult.ts
  tests/validateMatch.test.ts
  tests/calculateResult.test.ts
  tests/matches.integration.ts
mobile/
  .env                         # Local public API address, ignored
  .env.example
  .gitignore
  .claude/settings.json         # Expo template file
  AGENTS.md                     # Expo template instructions
  LICENSE                      # Expo template license
  package.json
  package-lock.json
  tsconfig.json
  eslint.config.js
  app.json
  src/app/_layout.tsx
  src/app/index.tsx
  src/app/create-match.tsx
  src/app/setup-innings.tsx
  src/app/innings/[inningsId].tsx
  src/app/matches/[matchId].tsx
  src/components/PrimaryButton.tsx
  src/components/MatchCard.tsx
  src/components/ConnectionCheck.tsx
  src/components/InningsScoringControls.tsx
  src/components/InningsPlayersCard.tsx
  src/services/api.ts
  src/types/api.ts
  public/phone-preview.html
  assets/icon.png
  assets/favicon.png
  assets/splash-icon.png
  assets/android-icon-foreground.png
  assets/android-icon-background.png
  assets/android-icon-monochrome.png
```

Installed dependencies, generated Prisma client files, and verification builds
are ignored. Prisma migration files are retained in the project.
