import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Fallback storage for web/non-secure environments
const webStore: Record<string, string> = {};

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      webStore[key] = value;
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    // Fallback
    try {
      localStorage.setItem(key, value);
    } catch {
      webStore[key] = value;
    }
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isWeb) {
      return localStorage.getItem(key) || webStore[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    try {
      return localStorage.getItem(key);
    } catch {
      return webStore[key] || null;
    }
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (isWeb) {
      delete webStore[key];
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      delete webStore[key];
    }
  }
}

export async function clear(): Promise<void> {
  const keys = ['auth_token', 'refresh_token', 'user_data', 'user_email', 'onboarding_complete'];
  for (const key of keys) {
    await removeItem(key);
  }
}

// ---- Auth-specific functions ----

export async function saveAuthData(data: {
  token: string;
  refreshToken?: string;
  userData?: string;
}): Promise<void> {
  await setItem('auth_token', data.token);
  if (data.refreshToken) {
    await setItem('refresh_token', data.refreshToken);
  }
  if (data.userData) {
    await setItem('user_data', data.userData);
  }
}

export async function getAuthData(): Promise<{
  token: string | null;
  refreshToken: string | null;
  userData: string | null;
}> {
  const [token, refreshToken, userData] = await Promise.all([
    getItem('auth_token'),
    getItem('refresh_token'),
    getItem('user_data'),
  ]);
  return { token, refreshToken, userData };
}

export async function clearAuthData(): Promise<void> {
  await removeItem('auth_token');
  await removeItem('refresh_token');
  await removeItem('user_data');
  await removeItem('user_email');
}

/** Get stored auth token */
export async function getStoredToken(): Promise<string | null> {
  return getItem('auth_token');
}

/** Save credentials (token + email) */
export async function saveCredentials(token: string, email: string): Promise<void> {
  await setItem('auth_token', token);
  await setItem('user_email', email);
}

/** Get stored user info */
export async function getStoredUser(): Promise<{ token: string; user: any } | null> {
  const token = await getItem('auth_token');
  const email = await getItem('user_email');
  if (!token) return null;
  return { token, user: { email } };
}

/** Clear all credentials */
export async function clearCredentials(): Promise<void> {
  await removeItem('auth_token');
  await removeItem('user_email');
  await removeItem('refresh_token');
  await removeItem('user_data');
}
