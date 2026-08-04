import { create } from 'zustand';
import { getItem, setItem } from '../services/database';

export type ThemeMode = 'light' | 'dark';

type ThemeStore = {
  mode: ThemeMode | null;
  setThemeMode: (mode: ThemeMode) => void;
  hydrateTheme: () => Promise<void>;
};

const THEME_STORAGE_KEY = 'theme_mode';
let hydrationPromise: Promise<void> | null = null;

/**
 * Stores an explicit user choice when one is made. A null value preserves the
 * device preference until the user chooses a theme from a sidebar.
 */
export const useThemeStore = create<ThemeStore>((set) => ({
  mode: null,

  setThemeMode: (mode) => {
    set({ mode });
    void setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  },

  hydrateTheme: async () => {
    if (!hydrationPromise) {
      hydrationPromise = getItem(THEME_STORAGE_KEY)
        .then((storedMode) => {
          if (storedMode === 'light' || storedMode === 'dark') {
            set({ mode: storedMode });
          }
        })
        .catch(() => {});
    }

    await hydrationPromise;
  },
}));
