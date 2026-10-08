import { getSession, setSession, type Session } from "./session";
import type {
  CreateMatchInput,
  ExtraEventType,
  HealthResponse,
  Match,
  MatchDetails,
  ScoreboardInnings,
  StartMatchInput,
  StartedMatch,
} from "../types/api";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const session = getSession();
  const headers = new Headers(options.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 && session && getSession() === session) setSession(null);
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error ?? "The backend is unavailable. Please try again.",
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The request timed out. Check your connection and refresh.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the backend. Check that it is running and the API address is correct.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const getHealth = () => request<HealthResponse>("/health");
export const getMatches = () => request<Match[]>("/matches");
export const getMatch = (matchId: string) =>
  request<MatchDetails>(`/matches/${encodeURIComponent(matchId)}`);
export const createMatch = (input: CreateMatchInput) =>
  request<Match>("/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
export const startMatch = (matchId: string, input: StartMatchInput) =>
  request<StartedMatch>(`/matches/${encodeURIComponent(matchId)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
export const getInnings = (inningsId: string) =>
  request<ScoreboardInnings>(`/innings/${encodeURIComponent(inningsId)}`);
export const recordScore = (inningsId: string, runs: number) =>
  request<ScoreboardInnings>(
    `/innings/${encodeURIComponent(inningsId)}/score`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runs }),
    },
  );
export const changeBowler = (inningsId: string, playerName: string) =>
  request<ScoreboardInnings>(
    `/innings/${encodeURIComponent(inningsId)}/change-bowler`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName }),
    },
  );
export const recordWicket = (inningsId: string) =>
  request<ScoreboardInnings>(
    `/innings/${encodeURIComponent(inningsId)}/wicket`,
    { method: "POST" },
  );
export const addNewBatsman = (inningsId: string, playerName: string) =>
  request<ScoreboardInnings>(
    `/innings/${encodeURIComponent(inningsId)}/new-batsman`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName }),
    },
  );
export const recordExtra = (inningsId: string, eventType: ExtraEventType) =>
  request<ScoreboardInnings>(
    `/innings/${encodeURIComponent(inningsId)}/extra`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType }),
    },
  );
export const endInnings = (inningsId: string) =>
  request<ScoreboardInnings>(`/innings/${encodeURIComponent(inningsId)}/end`, {
    method: "POST",
  });
export const startSecondInnings = (
  matchId: string,
  input: { strikerName: string; nonStrikerName: string; bowlerName: string },
) =>
  request<ScoreboardInnings>(
    `/matches/${encodeURIComponent(matchId)}/start-second-innings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
export const finishMatch = (matchId: string) =>
  request<unknown>(`/matches/${encodeURIComponent(matchId)}/finish`, {
    method: "POST",
  });

export async function authenticate(mode: "login" | "signup", email: string, password: string) {
  const session = await request<Session>(`/auth/${mode}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setSession(session);
}
export async function logout() {
  await request("/auth/logout", { method: "POST" });
  setSession(null);
}
