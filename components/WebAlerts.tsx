import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Spacing } from '../constants/theme';
import type { AlertPayload } from '../utils/webAlert';

const APPEARANCE: Record<AlertPayload['type'], { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { color: '#2563EB', icon: 'information-circle-outline' },
  success: { color: '#059669', icon: 'checkmark-circle-outline' },
  warning: { color: '#D97706', icon: 'warning-outline' },
  critical: { color: '#DC2626', icon: 'alert-circle-outline' },
};

/** Displays app alerts in the web build without relying on browser pop-ups. */
export default function WebAlerts() {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleAlert = (event: Event) => {
      const alert = (event as CustomEvent<AlertPayload>).detail;
      if (!alert?.id || !alert.title) return;
      setAlerts((current) => [...current.filter((item) => item.id !== alert.id), alert].slice(-3));
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== alert.id));
      }, 6000);
    };

    window.addEventListener('trucksphere:alert', handleAlert);
    return () => window.removeEventListener('trucksphere:alert', handleAlert);
  }, []);

  if (Platform.OS !== 'web' || alerts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {alerts.map((alert) => {
        const appearance = APPEARANCE[alert.type] || APPEARANCE.info;
        return (
          <View key={alert.id} style={[styles.alert, { borderLeftColor: appearance.color }]}>
            <Ionicons name={appearance.icon} size={22} color={appearance.color} />
            <View style={styles.copy}>
              <Text style={styles.title}>{alert.title}</Text>
              <Text style={styles.message}>{alert.message}</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Dismiss alert"
              accessibilityRole="button"
              onPress={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}
              style={styles.close}
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: '4%' as any,
    width: '92%',
    maxWidth: 380,
    gap: 10,
    zIndex: 10000,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
  copy: { flex: 1 },
  title: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  message: { color: '#475569', fontSize: 13, lineHeight: 18, marginTop: Spacing.xs },
  close: { padding: 2 },
});
