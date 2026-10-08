import type { CredentialStorage } from './sessionStore';
// Browser preview only. Never put bearer credentials into localStorage.
let value: string | null = null;
export const credentialStorage: CredentialStorage = {
  read: async () => value,
  write: async next => { value = next; },
  remove: async () => { value = null; },
};
