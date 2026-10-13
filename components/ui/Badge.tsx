import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({ label, variant = 'default', size = 'sm', dot = false }: BadgeProps) {
  const colors = useTheme();

  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: colors.surface, text: colors.slateText },
    success: { bg: colors.successBg, text: colors.successText },
    warning: { bg: colors.warningBg, text: colors.warningText },
    danger: { bg: colors.dangerBg, text: colors.dangerText },
    info: { bg: colors.infoBg, text: colors.infoText },
    purple: { bg: colors.purpleBg, text: colors.purpleText },
  };
  const tone = variantColors[variant];

  return (
    <Chip
      compact
      icon={dot ? 'circle' : undefined}
      style={[styles.badge, { backgroundColor: tone.bg, borderColor: colors.border, borderWidth: 1 }, size === 'md' && styles.medium]}
      textStyle={[styles.label, { color: tone.text }, size === 'md' && styles.labelMedium]}
      theme={{ colors: { onSurfaceVariant: tone.text } }}
    >
      {label}
    </Chip>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 24,
  },
  medium: {
    minHeight: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelMedium: {
    fontSize: 12,
  },
});
