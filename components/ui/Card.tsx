import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof Spacing | number;
}

export function Card({
  children,
  style,
  variant = 'default',
  padding = 'md',
}: CardProps) {
  const colors = useTheme();
  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const sharedProps = {
    style: [styles.card, variant === 'default' && { borderColor: colors.border, borderWidth: 1 }, style],
    contentStyle: { padding: paddingValue },
  };

  if (variant === 'elevated') {
    return <PaperCard mode="elevated" elevation={1} {...sharedProps}>{children}</PaperCard>;
  }

  if (variant === 'outlined') {
    return <PaperCard mode="outlined" {...sharedProps}>{children}</PaperCard>;
  }

  return <PaperCard mode="contained" {...sharedProps}>{children}</PaperCard>;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
});
