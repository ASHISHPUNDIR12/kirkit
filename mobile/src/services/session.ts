// Keep bearer credentials in memory, never in unencrypted device/browser storage.
export type Session = { token: string; expiresAt: string; user: { id: string; email: string } };
let session: Session | null = null;
const listeners = new Set<() => void>();
export const getSession = () => session;
export function setSession(value: Session | null) {
  session = value;
  listeners.forEach(listener => listener());
}
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
