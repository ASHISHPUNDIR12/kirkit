# Kirkit offline-first scoring

Kirkit now stores teams, players, matches, innings, score events, and undo history in a per-account SQLite database on the phone. Login and signup still use the backend. A saved session is held in Android/iOS secure storage, so a signed-in account can open and score matches offline. Passwords are never persisted. If the backend later rejects an expired session, the app asks the user to sign in again when online and leaves local scores available.

The local database is named for the authenticated account and uses versioned, additive migrations. Do not delete the database or lower `PRAGMA user_version` as a troubleshooting step. App updates preserve these files.

## Existing Neon matches

The old Prisma tables and their rows remain in place. No migration deletes or alters those match records. To copy a user's old saved data onto a device:

1. Sign in to that same Kirkit account on the device and connect it to the internet.
2. In `backend/.env`, set `ENABLE_LEGACY_EXPORT=true`, then restart the backend.
3. In the app's empty Match centre, tap **Import saved matches**. This is one owner-scoped, read-only export of that user's teams, players, matches, innings, ball-by-ball events, and undo history. The local transaction either imports the full export or rolls back.
4. Confirm the imported matches and scorecards on the device. Then set `ENABLE_LEGACY_EXPORT=false` and restart the backend.

Import is offered only when that account's local SQLite database has no teams or matches. This avoids overwriting or combining existing local scoring. If that condition is not met, keep the cloud rows in Neon and review a separate data-merging workflow before changing local data. The import copies rows; it does not delete them from Neon. Keep the existing database backup/retention policy until the copied records have been reviewed.

`LEGACY_SCORING_ENABLED` defaults to `false`. Therefore `/teams`, `/matches`, and `/innings` return HTTP 410 unless the variable is explicitly enabled. The app's scoring screens do not call those endpoints. For integration tests, the routes are enabled by the test environment. Do not enable legacy scoring in production as part of ordinary operation.

## PDF scorecards

Scorecard HTML and PDF files are generated on device with Expo Print, then copied to the app's documents folder under `scorecards/` and offered through the Android/iOS share sheet. Export reads SQLite only and works without internet. The user can use the share sheet to save or send the PDF.

## Running the app

Start the backend only when signing in, signing up, or importing old cloud matches. The backend still needs its normal Neon connection for those account operations. Expo Go still needs the Metro development server to load the app; once the app is open, cricket scoring and PDF creation make no backend request. For fully independent launches with no Metro server, install a standalone/development build on the device.

Install the SDK-matched packages in `mobile/` with `npx expo install` before starting the app. Then run `npx expo start --lan --go --port 8081 --clear` from `mobile/` and scan that QR code while phone and laptop share the same reachable LAN. Expo's tunnel concerns Metro only; it is not used for match scoring.

## Verification

From `mobile/`, run `node --experimental-strip-types --test tests/*.test.mjs` and `npx tsc --noEmit`. From `backend/`, run `npm test` and `npm run typecheck`. Integration tests require an explicitly configured disposable `TEST_DATABASE_URL`.
