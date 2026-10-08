import "./setupIntegration.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { app } from "../src/app.js";
import { prisma } from "../src/services/database.js";
import { digest } from "../src/middleware/auth.js";

test("auth protects matches, limits attempts, expires sessions and revokes logout", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const emails = [0, 1].map(() => `${randomUUID()}@example.test`);
  const password = "correct-horse-battery-staple";
  const request = (path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const live = await request("/live");
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("x-powered-by"), null);
    assert.equal(live.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await request("/health")).status, 200);
    assert.equal((await request("/unknown")).status, 404);
    assert.equal(
      (await request("/auth/signup", { oversized: "a".repeat(20000) })).status,
      413,
    );
    assert.equal((await request("/matches")).status, 401);
    assert.equal(
      (await request("/auth/signup", { email: emails[0], password: "weak" }))
        .status,
      400,
    );
    const signup = await request("/auth/signup", {
      email: emails[0].toUpperCase(),
      password,
    });
    assert.equal(signup.status, 201);
    const first = await signup.json();
    assert.equal(first.user.email, emails[0]);
    assert.equal(first.user.passwordHash, undefined);
    const stored = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: digest(first.token) },
    });
    assert.notEqual(stored.tokenHash, first.token);
    assert.equal(
      (await request("/auth/signup", { email: emails[0], password })).status,
      409,
    );
    assert.equal(
      (
        await request("/auth/login", {
          email: emails[0],
          password: "wrong-password-here",
        })
      ).status,
      401,
    );
    const login = await request("/auth/login", { email: emails[0], password });
    assert.equal(login.status, 200);
    const session = await login.json();
    assert.equal(
      (await request("/auth/me", undefined, session.token)).status,
      200,
    );
    const second = await (
      await request("/auth/signup", { email: emails[1], password })
    ).json();
    const created = await request(
      "/matches",
      { team1Name: "Auth A", team2Name: "Auth B", oversLimit: 2 },
      first.token,
    );
    assert.equal(created.status, 201);
    const match = await created.json();
    assert.equal(
      (await request(`/matches/${match.id}`, undefined, second.token)).status,
      404,
    );
    assert.deepEqual(
      await (await request("/matches", undefined, second.token)).json(),
      [],
    );
    const setup = {
      battingFirstTeam: "Auth A",
      strikerName: "A",
      nonStrikerName: "B",
      bowlerName: "C",
    };
    assert.equal(
      (await request(`/matches/${match.id}/start`, setup, second.token)).status,
      404,
    );
    const started = await (
      await request(`/matches/${match.id}/start`, setup, first.token)
    ).json();
    const inningsId = started.innings[0].id;
    assert.equal(
      (await request(`/innings/${inningsId}`, undefined, second.token)).status,
      404,
    );
    assert.equal(
      (await request(`/innings/${inningsId}/score`, { runs: 1 }, second.token))
        .status,
      404,
    );
    const concurrent = await Promise.all(
      [1, 2].map((runs) =>
        request(`/innings/${inningsId}/score`, { runs }, first.token),
      ),
    );
    assert.deepEqual(
      concurrent.map((response) => response.status),
      [200, 200],
    );
    const innings = await prisma.innings.findUniqueOrThrow({
      where: { id: inningsId },
      include: { ballEvents: true },
    });
    assert.equal(innings.runs, 3);
    assert.equal(innings.ballsInCurrentOver, 2);
    assert.equal(innings.ballEvents.length, 2);
    const revision = (await prisma.match.findUniqueOrThrow({ where: { id: match.id } })).revision;
    const replayHeaders = { 'Idempotency-Key': randomUUID(), 'X-Match-Revision': String(revision) };
    const duplicates = await Promise.all([0, 1].map(() => request(`/innings/${inningsId}/score`, { runs: 1 }, first.token, replayHeaders)));
    assert.deepEqual(duplicates.map(response => response.status), [200, 200]);
    assert.equal((await prisma.innings.findUniqueOrThrow({ where: { id: inningsId } })).runs, 4);
    assert.equal((await request(`/innings/${inningsId}/score`, { runs: 2 }, first.token, replayHeaders)).status, 409);
    assert.equal((await request(`/innings/${inningsId}/undo`, {}, second.token)).status, 404);
    assert.equal((await request(`/innings/${inningsId}/undo`, {}, first.token, { 'Idempotency-Key': randomUUID(), 'X-Match-Revision': String(revision + 1) })).status, 200);
    assert.equal((await prisma.innings.findUniqueOrThrow({ where: { id: inningsId } })).runs, 3);
    const savedTeam = await (await request('/teams', { name: 'Private team' }, first.token)).json();
    assert.equal((await request(`/teams/${savedTeam.id}/players`, { name: 'Intruder' }, second.token)).status, 404);
    assert.deepEqual(await (await request('/teams', undefined, second.token)).json(), []);
    await prisma.session.update({
      where: { tokenHash: digest(first.token) },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(
      (await request("/auth/me", undefined, first.token)).status,
      401,
    );
    assert.equal(
      (await request("/auth/logout", {}, session.token)).status,
      200,
    );
    assert.equal(
      (await request("/matches", undefined, session.token)).status,
      401,
    );
    await prisma.authThrottle.upsert({
      where: { key: digest(`email:${emails[1]}`) },
      create: {
        key: digest(`email:${emails[1]}`),
        hits: 10,
        expiresAt: new Date(Date.now() + 60000),
      },
      update: { hits: 10, expiresAt: new Date(Date.now() + 60000) },
    });
    assert.equal(
      (await request("/auth/login", { email: emails[1], password })).status,
      429,
    );
  } finally {
    await prisma.match.deleteMany({
      where: { owner: { email: { in: emails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.authThrottle.deleteMany({
      where: { key: { in: emails.map((email) => digest(`email:${email}`)) } },
    });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await prisma.$disconnect();
  }
});
