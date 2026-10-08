import * as SecureStore from 'expo-secure-store';
import type { CredentialStorage } from './sessionStore';
const key = 'kirkit.auth.v1';
export const credentialStorage: CredentialStorage = {
  read: () => SecureStore.getItemAsync(key),
  write: value => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  remove: () => SecureStore.deleteItemAsync(key),
};
