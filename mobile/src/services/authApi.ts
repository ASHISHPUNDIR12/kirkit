import { Platform } from 'react-native';
import { resolveApiConfig } from './apiConfig';
import { clearSession, getSession, invalidateSession, saveSession, type Session } from './session';
import type { HealthResponse } from '../types/api';

const config = resolveApiConfig(process.env.EXPO_PUBLIC_API_URL, Platform.OS);
export const API_URL = config.url;
class HttpError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }

/** Only auth, health and the explicit one-time legacy export can use the network. */
export async function authRequest<T>(path: string, options: RequestInit = {}, token: string | null = getSession()?.token ?? null): Promise<T> {
  if (!/^\/(auth\/(login|signup|logout|me|migration\/export)|health)$/.test(path)) throw new Error('This operation must use the local database.');
  if (config.error) throw new Error(config.error);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path === '/auth/migration/export' ? 60000 : 15000);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new HttpError(body?.error ?? `The authentication service returned ${response.status}.`, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (__DEV__) console.warn('[auth] request failed', { route: path, status: error instanceof HttpError ? error.status : undefined, timeout: controller.signal.aborted });
    if (controller.signal.aborted) throw new Error('The sign-in service timed out. You can keep scoring saved matches offline.');
    if (error instanceof TypeError) throw new Error('Cannot reach the sign-in service. Check your internet connection. Saved matches still work offline.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function authenticate(mode: 'login' | 'signup', email: string, password: string) {
  const before = getSession();
  const session = await authRequest<Session>(`/auth/${mode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }, null);
  if (getSession() !== before) throw new Error('Your account changed while signing in. Please try again.');
  await saveSession(session);
}
export async function logout() {
  const token = getSession()?.token;
  // Offline sign-out must succeed locally; server revocation is best effort.
  await clearSession();
  if (token) void authRequest('/auth/logout', { method: 'POST' }, token).catch(() => undefined);
}
let checking = false;
let lastCheck = 0;
export async function checkSession() {
  const session = getSession();
  if (!session?.token || checking) return;
  if (Date.parse(session.expiresAt) <= Date.now()) { await invalidateSession(session.token); return; }
  if (Date.now() - lastCheck < 60000) return;
  checking = true; lastCheck = Date.now();
  try {
    const result = await authRequest<{ user: Session['user'] }>('/auth/me', {}, session.token);
    if (result.user.id !== session.user.id) await invalidateSession(session.token);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) await invalidateSession(session.token);
    // No internet or a server outage must never remove local access.
  } finally { checking = false; }
}
export const getHealth = () => authRequest<HealthResponse>('/health', {}, null);
