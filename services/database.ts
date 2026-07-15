import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// ─── Web Crypto encryption constants ───
// Use a fixed encryption key derived from a deterministic source.
// This prevents plaintext data in localStorage while still allowing
// same-device read-back (the app itself needs to decrypt).
const ENCRYPTION_SECRET = 'trucksphere-secure-key-2024';
const ALGORITHM = 'AES-GCM';
const KEY_ALGORITHM = { name: 'PBKDF2' };
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];
const SALT = new Uint8Array([84, 83, 45, 83, 69, 67, 85, 82, 69, 45, 49, 50, 51]); // "TS-SECURE-123"

let cachedCryptoKey: CryptoKey | null = null;

/** Derive a stable AES-GCM CryptoKey from the fixed secret. */
async function getWebCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_SECRET),
    KEY_ALGORITHM,
    false,
    ['deriveKey'],
  );

  cachedCryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    KEY_USAGE,
  );

  return cachedCryptoKey;
}

/** Encrypts a string for web localStorage storage. */
async function encryptWeb(value: string): Promise<string> {
  const key = await getWebCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(value),
  );

  // Prepend the IV to the ciphertext, then base64-encode the whole buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypts a string from web localStorage. */
async function decryptWeb(encrypted: string): Promise<string> {
  const key = await getWebCryptoKey();

  // Decode the combined buffer: first 12 bytes = IV, rest = ciphertext
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

// Fallback in-memory store
const webStore: Record<string, string> = {};

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      const encrypted = await encryptWeb(value);
      localStorage.setItem(key, encrypted);
      webStore[key] = value;
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // Fallback: unencrypted on web, in-memory
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
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return webStore[key] || null;
      try {
        return await decryptWeb(encrypted);
      } catch {
        // If decryption fails, try raw value (migration from unencrypted)
        const raw = localStorage.getItem(key);
        return raw || webStore[key] || null;
      }
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