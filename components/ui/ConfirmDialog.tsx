import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dialog, Portal, Text } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  icon,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const colors = useTheme();
  const variantConfig = {
    danger: { color: colors.danger, button: 'danger' as const, fallbackIcon: 'alert-circle' as const },
    warning: { color: colors.warning, button: 'warning' as const, fallbackIcon: 'warning' as const },
    info: { color: colors.primary, button: 'primary' as const, fallbackIcon: 'information-circle' as const },
  }[variant];

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onCancel} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <View style={styles.content}>
            <View style={[styles.iconWrap, { backgroundColor: `${variantConfig.color}1F` }]}>
              <Ionicons name={icon || variantConfig.fallbackIcon} size={30} color={variantConfig.color} />
            </View>
            <Text variant="bodyMedium" style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          </View>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button title={cancelLabel} onPress={onCancel} variant="secondary" disabled={loading} />
          <Button title={confirmLabel} onPress={onConfirm} variant={variantConfig.button} loading={loading} />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 440,
    alignSelf: 'center',
    width: '92%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  message: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});
