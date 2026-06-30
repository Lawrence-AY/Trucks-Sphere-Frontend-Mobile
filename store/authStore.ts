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

const MOCK_USERS = {
  admin: {
    uid: "mock_admin",
    email: "admin@truck.com",
    displayName: "James Admin",
    role: "admin",
  },
  management: {
    uid: "mock_management",
    email: "management@truck.com",
    displayName: "Mary Management",
    role: "management",
  },
  vendor: {
    uid: "mock_vendor",
    email: "vendor@truck.com",
    displayName: "John Vendor",
    role: "vendor",
    vendorId: "v1",
  },
  site: {
    uid: "mock_site",
    email: "site@truck.com",
    displayName: "Anna Site",
    role: "operator_site",
    siteId: "s1",
  },
  quarry: {
    uid: "mock_quarry",
    email: "quarry@truck.com",
    displayName: "Peter Quarry",
    role: "operator_quarry",
    quarryId: "q1",
  },
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
    await clearAuthData();
    try {
      const credential = username.trim().toLowerCase();

      // ✅ Type‑safe lookup
      const match = MOCK_USERS[credential as keyof typeof MOCK_USERS];
      if (!match || password.length < 4) {
        throw new Error('Invalid username or password');
      }

      const mockToken = `mock_token_${Date.now()}`;
      const user: User = {
        uid: `mock_${credential}`,
        email: credential.includes('@') ? credential : `${credential}@truck.com`,
        displayName: match.displayName,
        role: match.role as any,
        vendorId: match.vendorId,
        quarryId: match.quarryId,
        siteId: match.siteId,
        phone: '',
        createdAt: new Date().toISOString(),
      };

      await saveAuthData({
        token: mockToken,
        userData: JSON.stringify(user),
      });

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
      await api.post('/auth/logout').catch(() => {});
    } catch {}
    await clearAuthData();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await withTimeout(getAuthData(), RESTORE_TIMEOUT_MS, 'Auth storage');
      if (stored.token) {
        try {
          const res = await withTimeout(api.get('/auth/profile'), RESTORE_TIMEOUT_MS, 'Auth profile');
          const user: User = res.data.user;
          set({ user, isLoading: false, isAuthenticated: true });
          return;
        } catch {
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