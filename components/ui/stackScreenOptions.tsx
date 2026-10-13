import React, { useMemo } from 'react';
import { useTheme, useThemeMode } from '../../hooks/useTheme';
import { canControlStatusBarAppearance } from '../../utils/statusBar';

type StackHeaderRight = () => React.ReactNode;
type ClearStackScreenOptions = {
  headerShown: boolean;
  headerStyle?: { backgroundColor: string };
  headerTintColor?: string;
  headerTitleStyle?: { fontWeight: '700'; fontSize: number };
  headerTitleAlign?: 'center';
  headerBackTitleVisible?: boolean;
  headerShadowVisible?: boolean;
  contentStyle?: { backgroundColor: string };
  statusBarStyle?: 'light' | 'dark';
  statusBarColor?: string;
  statusBarTranslucent?: boolean;
  animation: 'slide_from_right';
  headerRight?: StackHeaderRight;
};

/**
 * Shared native-stack presentation for standard screens.  Every layout that
 * relies on Expo Router's header now uses the same spacing, typography,
 * transition, and background treatment.
 */
export function useClearStackScreenOptions(headerRight?: StackHeaderRight): ClearStackScreenOptions {
  const colors = useTheme();
  const { isDark } = useThemeMode();
  const statusBarStyle = isDark ? 'light' : 'dark';
  return useMemo(() => ({
    headerShown: true,
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
    headerTitleAlign: 'center' as const,
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
    ...(canControlStatusBarAppearance ? {
      statusBarStyle,
      statusBarColor: colors.surface,
      statusBarTranslucent: false,
    } : {}),
    animation: 'slide_from_right' as const,
    headerRight,
  }), [colors.background, colors.surface, colors.text, headerRight, statusBarStyle]);
}

/** Use for screens that provide their own StackScreen/back header. */
export const CLEAR_HIDDEN_STACK_SCREEN_OPTIONS: ClearStackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
};
