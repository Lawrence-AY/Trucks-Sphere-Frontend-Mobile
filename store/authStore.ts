import { create } from 'zustand';
import api from '../services/api';
import { User } from './types';
import { saveAuthData, getAuthData, clearAuthData } from '../services/database';

const MOCK_USERS: Record<string, { displayName: string; role: string }> = {
  'admin@truck.com': { displayName: 'James Admin', role: 'management' },
  'quarry@truck.com': { displayName: 'Peter Quarry', role: 'operator_quarry' },
  'site@truck.com': { displayName: 'Anna Site', role: 'operator_site' },
  'vendor@truck.com': { displayName: 'John Vendor', role: 'vendor' },
};

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
    try {
      let user: User;

      try {
        // Try backend API first
        const res = await api.post('/auth/login', { email, password });
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
        const match = MOCK_USERS[email.toLowerCase()];
        if (!match || password.length < 4) {
          throw new Error('Invalid email or password');
        }

        const mockToken = `mock_token_${Date.now()}`;
        user = {
          uid: `mock_${email}`,
          email: email.toLowerCase(),
          displayName: match.displayName,
          role: match.role as any,
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
      const stored = await getAuthData();
      if (stored.token) {
        // Try backend validation
        try {
          const res = await api.get('/auth/profile');
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
    } catch {}
    set({ user: null, isLoading: false, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));
