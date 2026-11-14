import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_ID: 'userId',
  SESSION: 'session',
  SETTINGS: 'settings',
} as const;

export async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEYS.USER_ID);
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await AsyncStorage.setItem(KEYS.USER_ID, id);
  }
  return id;
}

export async function saveSession(session: object): Promise<void> {
  await AsyncStorage.setItem(KEYS.SESSION, JSON.stringify(session));
}

export async function loadSession(): Promise<object | null> {
  const raw = await AsyncStorage.getItem(KEYS.SESSION);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SESSION);
}

export async function saveSettings(settings: object): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadSettings(): Promise<object | null> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : null;
}
