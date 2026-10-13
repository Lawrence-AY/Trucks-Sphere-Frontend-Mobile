import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Text } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'cube-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useTheme();

  return (
    <Surface style={[styles.container, { backgroundColor: 'transparent' }]} elevation={0}>
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
        <Ionicons name={icon} size={40} color={colors.primaryText} />
      </View>
      <Text variant="titleMedium" style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} icon="add-circle-outline" style={styles.action} /> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  title: {
    textAlign: 'center', marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20, marginBottom: Spacing.xs,
  },
  action: { marginTop: Spacing.xs,
  },
});
