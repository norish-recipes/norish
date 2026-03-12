import * as SecureStore from 'expo-secure-store';

export const AUTH_STORAGE_PREFIX = 'norish';

const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;
const AUTH_SESSION_DATA_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_COOKIE_KEY),
    SecureStore.deleteItemAsync(AUTH_SESSION_DATA_KEY),
  ]);
}
