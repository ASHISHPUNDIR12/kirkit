# Backend deployment

The API uses Node 24, PostgreSQL, and email/password authentication. Deploy the
backend and updated mobile client together: all `/matches` and `/innings` routes
now require a bearer token. `/live` and `/health` remain public.

## Build and release

Run from `backend/`:

```sh
npm ci
npm run build
npm test
npm run prisma:validate
```

The build generates the Prisma client before compiling. Provide `DATABASE_URL`
as an environment variable; generation needs a valid URL but does not connect.
Set `NODE_ENV=production` at runtime. Use your platform's secret manager for URLs;
do not package `.env` files in images or commit credentials.

Before starting the new version, back up the database and run the additive
migrations once as a release job:

```sh
npm run prisma:deploy
npm run prisma:status
npm start
```

Migration commands require dev dependencies, including the Prisma CLI. Run them
before pruning dependencies or use the separate migration image below. Use a
direct connection in `DIRECT_URL` for migrations when `DATABASE_URL` is pooled.
Do not run `prisma migrate dev` or `db push` against production.

## Docker

```sh
docker build --target migrate -t kirkit-migrate .
docker build -t kirkit-backend .
docker run --rm --env-file /secure/path/backend-production.env kirkit-migrate
docker run -d --name kirkit-backend --restart unless-stopped \
  --env-file /secure/path/backend-production.env \
  -p 127.0.0.1:3000:3000 --stop-timeout 20 kirkit-backend
```

Supply actual production variables in the env file, including
`NODE_ENV=production`. Docker env files should use unquoted values. The final
image runs as an unprivileged user and contains compiled code and production
dependencies. Migrations run separately and must succeed before app rollout.
The image build uses a dummy URL; no production secret is needed at build time.

Terminate HTTPS at the hosting platform or reverse proxy. Allow inbound traffic
only through that proxy. Set `CORS_ORIGINS` to exact web origins, for example
`https://cricket.example.com`. An empty production list allows native/mobile
clients but grants no cross-origin browser access. CORS is not authentication.
If behind a proxy, set `TRUST_PROXY` to only its known IPs/CIDRs and ensure that
proxy overwrites forwarded headers. Otherwise auth attempts share the proxy's IP
limit. Leave it unset for direct connections; never trust arbitrary clients.

## Health and lifecycle

- `/live`: process liveness, no database dependency; used by Docker.
- `/health`: database readiness (`200` connected, `503` unavailable).
- Startup checks database connectivity. The release job ensures the schema exists.
- SIGTERM/SIGINT stop accepting connections and drain requests before disconnecting
  Prisma; after `SHUTDOWN_TIMEOUT_MS` the process exits with failure.
- Give the platform a termination grace period longer than the shutdown deadline.
- JSON request logs contain generated request IDs, methods, status and duration,
  with no body, query string, credentials or authorization header.
- Configure `DATABASE_POOL_SIZE` per replica to stay within the database limit.
  `DATABASE_TIMEOUT_MS` bounds connection acquisition and SQL statement duration.

## Authentication contract

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /auth/signup` | `{ "email": "you@example.com", "password": "a-long-password" }` | `201 { token, expiresAt, user: { id, email } }` |
| `POST /auth/login` | Same fields | `200` with the same session shape |
| `GET /auth/me` | Bearer token | `{ user: { id, email } }` |
| `POST /auth/logout` | Bearer token | `{ "status": "ok" }`; revokes that session |

Send `Authorization: Bearer <token>` on protected requests. Sessions expire after
seven days, with only SHA-256 token hashes stored in PostgreSQL. Passwords use
salted scrypt; email addresses are trimmed and lowercased. Passwords require at
least 12 characters and at most 128 UTF-8 bytes. No email verification, password
reset, or account recovery workflow is included in this basic implementation.

Signup/login share database-backed limits of 10 attempts per email and 40 per IP
per 15-minute window across replicas. Deploy an edge request limit as well to
bound overall traffic. `429` includes `Retry-After`. Login failures use a generic
message. Owners can access only their own matches and innings; other owners
receive `404`. Existing matches with a null owner stay preserved and inaccessible.
Assign legacy matches to a verified user through a deliberate administrative DB
update; there is no public claim endpoint.

The app keeps sessions only in memory; restarting/reloading requires signing in.
It clears the session on `401` and removes protected screens from navigation.
The navigation pattern follows [Expo's protected-route documentation](https://docs.expo.dev/router/advanced/protected/).
Password derivation uses [Node's scrypt API](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

Schedule daily database housekeeping (expired rows no longer grant access even
before cleanup):

```sql
DELETE FROM "Session" WHERE "expiresAt" < NOW();
DELETE FROM "AuthThrottle" WHERE "expiresAt" < NOW();
```

## Verification and remaining release checks

Use a disposable PostgreSQL database for integration tests:

```sh
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kirkit_test
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm run prisma:deploy
npm run test:integration
```

Integration tests refuse to run without `TEST_DATABASE_URL`. They cover the match
flow, cross-account isolation, password login, expired/revoked sessions, rate
limits, and concurrent scoring. `.github/workflows/backend.yml` runs these against
PostgreSQL and builds both Docker targets.

Local unit tests, compilation, schema validation, and mobile typecheck/lint can
run in the restricted workspace. Live HTTP tests and Docker execution require
socket access unavailable here; run CI and a deployment smoke test before release.
All migration SQL was applied successfully to disposable embedded PostgreSQL.
The dependency audit could not reach the npm registry in this environment; CI
runs the production dependency audit with a high-severity failure threshold.
No production database migrations or deployment have been performed by this change.
After rollout, verify readiness, signup/login, match creation/scoring, and logout
through the public HTTPS URL. Configure database backups and monitor 5xx errors.
