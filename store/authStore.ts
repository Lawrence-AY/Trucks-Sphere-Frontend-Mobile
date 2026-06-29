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

const MOCK_USERS: Record<string, { displayName: string; role: string; vendorId?: string }> = {
  'admin@truck.com': { displayName: 'James Admin', role: 'admin' },
  admin: { displayName: 'James Admin', role: 'admin' },
  'management@truck.com': { displayName: 'Mary Management', role: 'management' },
  management: { displayName: 'Mary Management', role: 'management' },
  'quarry@truck.com': { displayName: 'Peter Quarry', role: 'operator_quarry' },
  quarry: { displayName: 'Peter Quarry', role: 'operator_quarry' },
  'site@truck.com': { displayName: 'Anna Site', role: 'operator_site' },
  site: { displayName: 'Anna Site', role: 'operator_site' },
  'vendor@truck.com': { displayName: 'John Vendor', role: 'vendor', vendorId: 'v1' },
  vendor: { displayName: 'John Vendor', role: 'vendor', vendorId: 'v1' },
};

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      let user: User;
      const credential = username.trim().toLowerCase();

      try {
        // Try backend API first
        const res = await api.post('/auth/login', { username: credential, email: credential, password });
        user = res.data.user;
        const token = res.data.token || res.data.user?.uid || `token_${Date.now()}`;

        // Save credentials securely
        await saveAuthData({
          token,
          refreshToken: res.data.refreshToken || '',
          userData: JSON.stringify(user),
        });
      } catch {
        // Fallback to mock for dev
        const match = MOCK_USERS[credential];
        if (!match || password.length < 4) {
          throw new Error('Invalid username or password');
        }

        const mockToken = `mock_token_${Date.now()}`;
        user = {
          uid: `mock_${credential}`,
          email: credential.includes('@') ? credential : `${credential}@truck.com`,
          displayName: match.displayName,
          role: match.role as any,
          vendorId: match.vendorId,
          phone: '',
          createdAt: new Date().toISOString(),
        };

        // Save mock credentials
        await saveAuthData({
          token: mockToken,
          userData: JSON.stringify(user),
        });
      }

      set({ user, isLoading: false, isAuthenticated: true, error: null });
    } catch (err: any) {
      set({
        error: err?.response?.data?.error || err.message || 'Login failed',
        isLoading: false,
        isAuthenticated: false,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      // Try backend logout
      await api.post('/auth/logout').catch(() => {});
    } catch {}
    // Clear all stored credentials
    await clearAuthData();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await withTimeout(getAuthData(), RESTORE_TIMEOUT_MS, 'Auth storage');
      if (stored.token) {
        // Try backend validation
        try {
          const res = await withTimeout(api.get('/auth/profile'), RESTORE_TIMEOUT_MS, 'Auth profile');
          const user: User = res.data.user;
          set({ user, isLoading: false, isAuthenticated: true });
          return;
        } catch {
          // Token expired or backend unavailable — try stored user data
          if (stored.userData) {
            try {
              const user: User = JSON.parse(stored.userData);
              set({ user, isLoading: false, isAuthenticated: true });
              return;
            } catch {}
          }
        }
      }
    } catch (error) {
      console.warn('Session restore failed:', error);
    }
    set({ user: null, isLoading: false, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));
