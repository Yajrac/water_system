import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
const key = 'pwss-consumer-session';
let writes: Promise<void> = Promise.resolve();
export async function readSession() {
  await writes;
  return Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
}
export function saveSession(token: string | null) {
  const operation = writes.catch(() => {}).then(async () => {
    if (Platform.OS === 'web') {
      if (token) sessionStorage.setItem(key, token); else sessionStorage.removeItem(key);
    } else if (token) await SecureStore.setItemAsync(key, token);
    else await SecureStore.deleteItemAsync(key);
  });
  writes = operation;
  return operation;
}
