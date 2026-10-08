# Scoring tools, teams and scorecards

## Enable this update

Stop the development backend, then run from WSL:

```sh
cd /home/ashish_pundir/projects/kirkit/backend
npm run prisma:deploy
npm run prisma:generate
npm run dev
```

The migration adds teams, saved players, match revisions and action history. It
preserves existing matches and scores. Do not reset your database. Restart/reload
Expo after updating the app. Follow [start.md](../start.md) for phone networking.
The migration has not been applied to your Neon database by the agent.

## Undo

The scoreboard has an **Undo** button with the action it will reverse. It restores
runs, wickets, legal balls, strike, bowler/player figures, player replacements,
target and match result. A delivery that ended an innings or won the match can
be undone. Open the completed match's **Open scoreboard / undo** link to correct it.

Undo operates one action at a time: after adding a replacement batsman, first
undo the replacement, then undo the wicket. Bowler changes and manually finishing
an innings are also recorded actions. Repeated undo walks backward through the
current innings. Once the second innings starts, first-innings undo is blocked so
the chase target cannot change underneath an ongoing chase. Starting an innings
itself is not undoable.

Existing deliveries from before this update have no historical snapshots and
cannot be undone. New actions in an existing match are undoable. There is no redo
button; enter the corrected action normally after undo.

## Duplicate scoring protection

The mobile client sends an `Idempotency-Key` and `X-Match-Revision` with every
scoring, wicket, extra, player/bowler change, finish and undo request. An ambiguous
network failure keeps the same request ID for a retry of the same action and
revision. The backend stores accepted IDs in PostgreSQL, inside the transaction
that changes the score. Simultaneous requests serialize on the match row.

- A repeated ID with the same operation returns the current scoreboard without
  applying it again, including if that action was later undone.
- Reusing an ID for a different operation returns `409`.
- A new operation from an old match revision returns `409`; tap **Refresh
  scoreboard**, check the latest score, then enter the intended action.
- Buttons block overlapping taps locally. Database checks protect against retries
  and multiple devices, independent of the app's button state.

Headers remain optional for older clients; older clients do not gain automatic
retry protection until updated. This is not an offline scoring queue. Match
creation and initial innings setup are outside the scoring idempotency contract.

## Teams and saved players

Open **Teams & player statistics** from Home. Save a team and add its players.
When creating a match, tap the saved-team chips for each side. During innings
setup, batsman replacement, bowler changes and chase setup, tap a saved player
instead of typing their name. Custom team/player names still work.

Team names are unique within your account, and player names within a team,
ignoring case. Another account cannot read your rosters, add players to them, or
attach your teams to its matches. Players are linked by stable saved-player IDs;
match records retain their displayed names. A player with the same name on two
teams is a separate saved identity for each team.

Career totals show matches, runs, wickets, batting strike rate, bowling economy
and batting average. A match with both batting and bowling records counts once.
The figures include current matches and are calculated from the saved innings,
so undo corrects them automatically. Old unlinked matches and custom players do
not automatically contribute to a saved player's career totals. Typed names that
match a player on the match's selected saved team are linked to that player.

This version supports creating teams and adding players; roster rename, transfer
and deletion flows are not included.

## Full scorecards

Open **Full scorecard** from a scoreboard or open a match from history. Each
innings shows:

- Batting runs, balls, fours, sixes and strike rate.
- Bowling overs, conceded runs, wickets and economy.
- Wide/no-ball extras breakdown and team run rate.
- Fall of wickets with score, dismissed player and legal-ball over position.
- Partnerships with both names, runs and legal balls.
- Over-by-over runs, wickets, extras and cumulative score.
- The existing delivery history.

Extras add to team/partnership runs without adding legal balls. Rates with no
legal balls or no dismissals display a dash rather than a misleading zero or
infinity. Legacy deliveries did not record the non-striker; scorecards label a
missing partner as unrecorded rather than inventing their identity. Statistics
follow this app's existing simplified wide/no-ball rules.

## API additions

| Route | Purpose |
| --- | --- |
| `GET /teams` | Your teams, players and career totals |
| `POST /teams` with `{ "name": "Tigers" }` | Save a team |
| `POST /teams/:teamId/players` with `{ "name": "Aman" }` | Add a player to your team |
| `POST /innings/:inningsId/undo` | Undo the latest recorded action in the current innings |

All routes require the existing bearer authentication. `POST /matches` accepts
optional `team1Id` and `team2Id` alongside team names and overs. Match details add
an innings `scorecard`; scoreboard responses add `canUndo`, `undoLabel`, and
`match.revision`. Existing response fields remain available. Scorecard access is
private; live score sharing was not added.

## Verification

- Backend build, unit tests and Prisma schema validation.
- Mobile typecheck, lint, URL tests and Android production bundle export.
- Sequential service scenarios against disposable embedded PostgreSQL: idempotent
  replay, stale revisions, undo after player changes, over-ending wickets and
  scores, manual innings completion, winning deliveries/extras, roster ownership
  and career totals after undo. All versioned migrations applied in that database.
- The checked-in PostgreSQL integration suite also tests simultaneous duplicate
  HTTP requests, cross-account undo and roster access. Run it against a disposable
  test database using `TEST_DATABASE_URL` (see backend/DEPLOYMENT.md).

The agent environment blocks network sockets, so the full HTTP/concurrency suite
and physical-device UI verification must run outside it. No public sharing or
hosting changes were made.
