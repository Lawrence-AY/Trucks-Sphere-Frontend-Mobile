import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HelperText, TextInput as PaperTextInput } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  editable?: boolean;
  suffix?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  required = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  secureTextEntry = false,
  editable = true,
  suffix,
  autoFocus = false,
  onBlur,
}: InputProps) {
  const colors = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <PaperTextInput
        mode="outlined"
        label={required ? `${label} *` : label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        secureTextEntry={secureTextEntry && !showPassword}
        disabled={!editable}
        autoFocus={autoFocus}
        onBlur={onBlur}
        error={Boolean(error)}
        outlineColor={colors.border}
        activeOutlineColor={colors.primary}
        textColor={colors.text}
        cursorColor={colors.primary}
        selectionColor={colors.primary}
        dense={!multiline}
        style={[styles.input, multiline && { minHeight: Math.max(numberOfLines * 28 + 32, 100) }]}
        left={icon ? <PaperTextInput.Icon icon={({ color, size }) => <Ionicons name={icon} color={color} size={size} />} /> : undefined}
        right={
          secureTextEntry ? (
            <PaperTextInput.Icon
              icon={({ color, size }) => <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} color={color} size={size} />}
              onPress={() => setShowPassword((current) => !current)}
              forceTextInputFocus={false}
            />
          ) : suffix ? (
            <PaperTextInput.Affix text={suffix} />
          ) : undefined
        }
      />
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.xs,
    minWidth: 0,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
