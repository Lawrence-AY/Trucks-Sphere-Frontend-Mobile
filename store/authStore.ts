import { create } from 'zustand';
import api from '../services/api';
import { User } from './types';
import { saveAuthData, getAuthData, clearAuthData } from '../services/database';

const RESTORE_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    await clearAuthData();
    try {
      console.log('[AuthStore] Logging in via backend /api/auth/login...');
      const response = await api.post('/api/auth/login', { username: email, password });
      console.log('[AuthStore] Login response:', response.data);

      const { user: backendUser, token, refreshToken } = response.data as any;

      if (!backendUser || !token) {
        throw new Error('Invalid response from server');
      }

      const user: User = {
        uid: backendUser.uid,
        email: backendUser.email,
        displayName: backendUser.displayName || backendUser.name || email.split('@')[0],
        name: backendUser.name || backendUser.displayName,
        role: backendUser.role || 'management',
        phone: backendUser.phone || '',
        vendorId: backendUser.vendorId || undefined,
        quarryId: backendUser.quarryId || undefined,
        siteId: backendUser.siteId || undefined,
        createdAt: new Date().toISOString(),
      };

      console.log('[AuthStore] Saving user data:', user);

      await saveAuthData({
        token,
        refreshToken: refreshToken || '',
        userData: JSON.stringify(user),
      });

      set({ user, isLoading: false, isAuthenticated: true, error: null });
      console.log('[AuthStore] Login successful, user authenticated');
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err.message || 'Login failed';
      console.error('[AuthStore] Login failed:', errorMsg);
      set({
        error: errorMsg,
        isLoading: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout').catch(() => {});
    } catch {}
    await clearAuthData();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await withTimeout(getAuthData(), RESTORE_TIMEOUT_MS, 'Auth storage');
      if (stored.token) {
        // Skip backend profile call for mock tokens — they will fail Firebase verifyIdToken
        const isMockToken = stored.token.startsWith('mock_');

        if (!isMockToken) {
          try {
            console.log('[AuthStore] Restoring session via /api/auth/profile...');
            const res = await withTimeout(api.get('/api/auth/profile'), RESTORE_TIMEOUT_MS, 'Auth profile');
            const user: User = res.data.user;
            console.log('[AuthStore] Session restored from backend:', user);
            set({ user, isLoading: false, isAuthenticated: true });
            return;
          } catch (profileErr: any) {
            const status = profileErr?.response?.status;
            console.warn(`[AuthStore] Backend profile fetch failed (${status || 'network error'}), using stored data`);
          }
        } else {
          console.log('[AuthStore] Mock token detected, using stored session data');
        }

        // Fallback to stored userData (works for both mock tokens and expired real tokens)
        if (stored.userData) {
          try {
            const user: User = JSON.parse(stored.userData);
            console.log('[AuthStore] Session restored from stored data:', user);
            set({ user, isLoading: false, isAuthenticated: true });
            return;
          } catch {}
        }
      }
    } catch (error) {
      console.warn('[AuthStore] Session restore failed:', error);
    }
    set({ user: null, isLoading: false, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));