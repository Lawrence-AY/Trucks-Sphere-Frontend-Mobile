import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { router } from '../../utils/router';
export function BackButton({ onPress, style, ...props }: TouchableOpacityProps) {
  const colors = useTheme();
  return <TouchableOpacity {...props} accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress || (() => router.back())} style={[style, { borderWidth: 0, width: 44, height: 44, minWidth: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }]}>
    <Ionicons name="arrow-back" size={20} color={colors.text} />
  </TouchableOpacity>;
}
