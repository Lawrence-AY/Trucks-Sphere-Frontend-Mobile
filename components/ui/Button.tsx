import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const colors = useTheme();
  const buttonColor = ({
    primary: colors.primary,
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
  } as Partial<Record<ButtonVariant, string>>)[variant];
  const textColor = variant === 'secondary' || variant === 'ghost' ? colors.text : '#FFFFFF';
  const mode = variant === 'ghost' ? 'text' : variant === 'secondary' ? 'outlined' : 'contained';
  const height = { sm: 36, md: 44, lg: 52 }[size];

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      buttonColor={buttonColor}
      textColor={textColor}
      icon={icon ? ({ color, size: iconSize }) => <Ionicons name={icon} color={color} size={iconSize} /> : undefined}
      contentStyle={[styles.content, { height }]}
      labelStyle={[styles.label, size === 'sm' && styles.labelSmall, size === 'lg' && styles.labelLarge]}
      style={[styles.button, fullWidth && styles.fullWidth, style]}
      uppercase={false}
    >
      {title}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 5,
    minWidth: 0,
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 13,
  },
  labelLarge: {
    fontSize: 16,
  },
});
