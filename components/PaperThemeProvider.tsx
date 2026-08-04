import React, { useMemo } from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { Colors } from '../constants/theme';
import { useThemeMode } from '../hooks/useTheme';

/**
 * The Paper theme is deliberately built from the existing TruckSphere palette.
 * This lets Paper components and the remaining app-specific components share
 * the same colors while the migration is completed screen by screen.
 */
function createPaperTheme(dark: boolean) {
  const palette = dark ? Colors.dark : Colors.light;
  const base = dark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    dark,
    roundness: 5,
    colors: {
      ...base.colors,
      primary: palette.primary,
      onPrimary: '#FFFFFF',
      primaryContainer: palette.primaryLight,
      onPrimaryContainer: palette.primary,
      secondary: palette.accent,
      onSecondary: '#FFFFFF',
      secondaryContainer: `${palette.accent}1F`,
      onSecondaryContainer: palette.accent,
      tertiary: palette.warning,
      onTertiary: '#FFFFFF',
      background: palette.background,
      onBackground: palette.text,
      surface: palette.surface,
      onSurface: palette.text,
      surfaceVariant: palette.inputBg,
      onSurfaceVariant: palette.textSecondary,
      outline: palette.border,
      outlineVariant: palette.borderLight,
      error: palette.danger,
      onError: '#FFFFFF',
      errorContainer: `${palette.danger}1F`,
      onErrorContainer: palette.danger,
      elevation: {
        level0: 'transparent',
        level1: palette.surface,
        level2: palette.surface,
        level3: palette.surface,
        level4: palette.surface,
        level5: palette.surface,
      },
    },
  };
}

export function PaperThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeMode();
  const theme = useMemo(() => createPaperTheme(isDark), [isDark]);

  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}
