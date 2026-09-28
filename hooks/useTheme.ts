import { Colors } from '../constants/theme';
import { useColorScheme } from 'react-native';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';

export type ThemePreference = {
  mode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

/** Resolves an explicit in-app choice, falling back to the device preference. */
export const useThemeMode = (): ThemePreference => {
  const systemScheme = useColorScheme();
  const storedMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const isDark = (storedMode ?? systemScheme) === 'dark';
  const mode: ThemeMode = isDark ? 'dark' : 'light';

  return {
    mode,
    isDark,
    setThemeMode,
    toggleTheme: () => setThemeMode(isDark ? 'light' : 'dark'),
  };
};

export const useTheme = () => {
  const { isDark } = useThemeMode();
  return isDark ? Colors.dark : Colors.light;
};

/** Keeps native status-bar text readable against the active app theme. */
export const useStatusBarStyle = (): 'light' | 'dark' =>
  useThemeMode().isDark ? 'light' : 'dark';
