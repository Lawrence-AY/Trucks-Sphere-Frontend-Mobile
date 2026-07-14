import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

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

  const variantStyles: Record<ButtonVariant, { bg: string; text: string }> = {
    primary: { bg: colors.primary, text: '#FFFFFF' },
    secondary: { bg: colors.surface, text: colors.text },
    danger: { bg: colors.danger, text: '#FFFFFF' },
    ghost: { bg: 'transparent', text: colors.primary },
    success: { bg: colors.success, text: '#FFFFFF' },
    warning: { bg: '#F59E0B', text: '#FFFFFF' },
  };

  const sizeStyles: Record<ButtonSize, { height: number; fontSize: number; iconSize: number; paddingHorizontal: number }> = {
    sm: { height: 36, fontSize: 13, iconSize: 16, paddingHorizontal: Spacing.md },
    md: { height: 44, fontSize: 14, iconSize: 18, paddingHorizontal: Spacing.lg },
    lg: { height: 52, fontSize: 16, iconSize: 20, paddingHorizontal: Spacing.xl },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: vs.bg,
          height: ss.height,
          paddingHorizontal: ss.paddingHorizontal,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={ss.iconSize} color={vs.text} />}
          <Text style={[styles.text, { color: vs.text, fontSize: ss.fontSize }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '700',
  },
});
