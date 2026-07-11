import { Platform } from 'react-native';

export const showConfirm = (title: string, message: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    const result = window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(result);
  }
  const { Alert } = require('react-native');
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });
};

export const showAlert = (title: string, message: string): Promise<void> => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }
  const { Alert } = require('react-native');
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
};

// ─── Shared Alert Sync Utility ───
// When the mobile app creates an alert, it should also be displayable on web.
// This utility normalizes alert creation across platforms and stores alerts
// in a shared collection for cross-platform visibility.

let alertSyncHandler: ((alert: AlertPayload) => void) | null = null;

export interface AlertPayload {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
  source: 'mobile' | 'web';
  readAt?: string;
  relatedJobId?: string;
  relatedEntityType?: string;
}

/**
 * Register a handler that will be called whenever a synced alert is triggered.
 * On web, this can update a toast/notification state.
 * On mobile, showSystemAlert defaults to true for backwards compatibility.
 */
export function setAlertSyncHandler(handler: (alert: AlertPayload) => void) {
  alertSyncHandler = handler;
}

/**
 * Show an alert on the current platform AND dispatch it to the sync handler
 * so it can also appear on the web dashboard (if connected).
 */
export function showSyncedAlert(
  title: string,
  message: string,
  type: AlertPayload['type'] = 'info',
  relatedJobId?: string
): void {
  const payload: AlertPayload = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
    source: Platform.OS === 'web' ? 'web' : 'mobile',
    relatedJobId,
  };

  // Dispatch to sync handler (e.g. save to Firestore alerts collection)
  if (alertSyncHandler) {
    alertSyncHandler(payload);
  }

  // Also show native alert on the current device
  if (Platform.OS === 'web') {
    // Web: dispatch a custom event so any dashboard UI can pick it up
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trucksphere:alert', { detail: payload }));
    }
  } else {
    const { Alert } = require('react-native');
    const icon = type === 'critical' ? '🚨' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    Alert.alert(`${icon} ${title}`, message, [{ text: 'OK' }]);
  }
}

/**
 * Show a synced confirm dialog. Returns true if user confirmed.
 * On web, uses native confirm(). On mobile, uses Alert.alert with Cancel/OK.
 * Also dispatches to the sync handler for visibility on web dashboard.
 */
export async function showSyncedConfirm(
  title: string,
  message: string,
  type: AlertPayload['type'] = 'warning',
  relatedJobId?: string
): Promise<boolean> {
  const payload: AlertPayload = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
    source: Platform.OS === 'web' ? 'web' : 'mobile',
    relatedJobId,
  };

  // Dispatch to sync handler
  if (alertSyncHandler) {
    alertSyncHandler(payload);
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trucksphere:alert', { detail: payload }));
    }
    return window.confirm(`${title}\n\n${message}`);
  }

  const { Alert } = require('react-native');
  const icon = type === 'critical' ? '🚨' : type === 'warning' ? '⚠️' : '❓';
  return new Promise((resolve) => {
    Alert.alert(`${icon} ${title}`, message, [
      { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });
}
