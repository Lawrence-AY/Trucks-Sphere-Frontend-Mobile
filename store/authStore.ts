import { create } from 'zustand';
import api from '../services/api';
import { User } from './types';
import { saveAuthData, getAuthData, clearAuthData } from '../services/database';
import { setRealtimeSessionScope, useRealTimeSyncStore } from './realTimeSyncStore';

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
      const response = await api.post('/api/auth/login', { username: email, password });

      const { user: backendUser, token, refreshToken } = response.data as any;

      if (!backendUser || !token) {
        throw new Error('Invalid response from server');
      }

      const user: User = {
        uid: backendUser.uid,
        email: backendUser.email,
        displayName: backendUser.displayName || backendUser.name || email.split('@')[0],
        name: backendUser.name || backendUser.displayName,
        username: backendUser.username || undefined,
        role: backendUser.role || 'admin',
        phone: backendUser.phone || '',
        vendorId: backendUser.vendorId || undefined,
        quarryId: backendUser.quarryId || undefined,
        quarryLocation: backendUser.quarryLocation || undefined,
        siteId: backendUser.siteId || undefined,
        isActive: true,
        createdBy: backendUser.createdBy || 'system',
        createdAt: new Date().toISOString(),
      };


      await saveAuthData({
        token,
        refreshToken: refreshToken || '',
        userData: JSON.stringify(user),
      });

      useRealTimeSyncStore.getState().clearSession();
      setRealtimeSessionScope(user.uid);
      set({ user, isLoading: false, isAuthenticated: true, error: null });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err.message || 'Login failed';
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
    useRealTimeSyncStore.getState().clearSession();
    setRealtimeSessionScope();
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
            const res = await withTimeout(api.get('/api/auth/profile'), RESTORE_TIMEOUT_MS, 'Auth profile');
            const user: User = res.data.user;
            useRealTimeSyncStore.getState().clearSession();
            setRealtimeSessionScope(user.uid);
            set({ user, isLoading: false, isAuthenticated: true });
            return;
          } catch (profileErr: any) {
            const status = profileErr?.response?.status;
          }
        } else {
        }

        // Fallback to stored userData (works for both mock tokens and expired real tokens)
        if (stored.userData) {
          try {
            const user: User = JSON.parse(stored.userData);
            useRealTimeSyncStore.getState().clearSession();
            setRealtimeSessionScope(user.uid);
            set({ user, isLoading: false, isAuthenticated: true });
            return;
          } catch {}
        }
      }
    } catch (error) {
    }
    useRealTimeSyncStore.getState().clearSession();
    setRealtimeSessionScope();
    set({ user: null, isLoading: false, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));
