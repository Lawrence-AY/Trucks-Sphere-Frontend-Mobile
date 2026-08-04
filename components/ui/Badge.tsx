import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: '#F3F4F6', text: '#6B7280' },
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  danger: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
  purple: { bg: '#EDE9FE', text: '#5B21B6' },
};

export function Badge({ label, variant = 'default', size = 'sm', dot = false }: BadgeProps) {
  const colors = VARIANT_COLORS[variant];

  return (
    <Chip
      compact
      icon={dot ? 'circle' : undefined}
      style={[styles.badge, { backgroundColor: colors.bg }, size === 'md' && styles.medium]}
      textStyle={[styles.label, { color: colors.text }, size === 'md' && styles.labelMedium]}
      theme={{ colors: { onSurfaceVariant: colors.text } }}
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
