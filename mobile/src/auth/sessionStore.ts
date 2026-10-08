import { serialize } from '../database/types.ts';

export type Session = {
  token: string | null;
  expiresAt: string;
  user: { id: string; email: string };
};
export type AuthState = { ready: boolean; session: Session | null; error: string | null };
export interface CredentialStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  return !!s.user && typeof s.user.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(s.user.id) &&
    typeof s.user.email === 'string' && s.user.email.length <= 254 &&
    typeof s.expiresAt === 'string' && Number.isFinite(Date.parse(s.expiresAt)) &&
    (s.token === null || (typeof s.token === 'string' && /^[a-f0-9]{64}$/i.test(s.token)));
}
export function createSessionStore(storage: CredentialStorage) {
  let state: AuthState = { ready: false, session: null, error: null };
  const listeners = new Set<() => void>();
  const enqueue = serialize();
  const publish = (next: AuthState) => { state = next; listeners.forEach(listener => listener()); };
  const write = async (session: Session) => {
    // Whitelist the stored fields: credentials supplied by the user never enter storage.
    const safe: Session = { user: { id: session.user.id, email: session.user.email }, token: session.token, expiresAt: session.expiresAt };
    await storage.write(JSON.stringify({ version: 1, session: safe }));
    publish({ ready: true, session: safe, error: null });
  };
  return {
    getState: () => state,
    getSession: () => state.session,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restore: () => enqueue(async () => {
      if (state.ready) return;
      try {
        const raw = await storage.read();
        if (!raw) { publish({ ready: true, session: null, error: null }); return; }
        const record = JSON.parse(raw);
        if (record.version !== 1 || !validSession(record.session)) throw new Error('Invalid saved session');
        publish({ ready: true, session: record.session, error: null });
      } catch {
        publish({ ready: false, session: null, error: 'Unable to open your saved sign-in. Retry, or sign in again. Your matches will be kept.' });
      }
    }),
    save: (session: Session) => enqueue(async () => {
      if (!validSession(session) || !session.token) throw new Error('The server returned an invalid sign-in. Please try again.');
      if (state.session && state.session.user.id !== session.user.id) throw new Error('Sign out before switching accounts. Your local matches will be kept.');
      try { await write(session); }
      catch (error) {
        if (error instanceof Error && /switching accounts/.test(error.message)) throw error;
        throw new Error('Could not securely save your sign-in. Please try again before going offline.');
      }
    }),
    invalidate: (token: string) => enqueue(async () => {
      if (state.session?.token !== token) return;
      // Online authorization and permission to use existing local data are separate.
      await write({ ...state.session, token: null });
    }),
    clear: () => enqueue(async () => {
      try { await storage.remove(); }
      catch { throw new Error('Could not remove saved sign-in. Please try signing out again.'); }
      publish({ ready: true, session: null, error: null });
    }),
  };
}
