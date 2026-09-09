import { Alert, Platform } from 'react-native';
import { installWebAlertBridge } from './webAlertQueue';

// Loaded by the root before any screen can display an alert.
installWebAlertBridge();

export const showConfirm = (title: string, message: string): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
      { text: 'OK', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });

export const showAlert = (title: string, message: string): Promise<void> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });

/** Run navigation or other follow-up work only after acknowledgement. */
export const showAlertWithCallback = (
  title: string, message: string, onDismiss: () => void,
): Promise<void> => new Promise((resolve) => {
  Alert.alert(title, message, [{ text: 'OK', onPress: () => {
    try { onDismiss(); } finally { resolve(); }
  } }]);
});

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

let alertSyncHandler: ((alert: AlertPayload) => void) | null = null;
export function setAlertSyncHandler(handler: (alert: AlertPayload) => void) {
  alertSyncHandler = handler;
}

function syncAlert(title: string, message: string, type: AlertPayload['type'], relatedJobId?: string) {
  alertSyncHandler?.({
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    title, message, type, relatedJobId,
    timestamp: new Date().toISOString(),
    source: Platform.OS === 'web' ? 'web' : 'mobile',
  });
}

export function showSyncedAlert(title: string, message: string, type: AlertPayload['type'] = 'info', relatedJobId?: string): void {
  syncAlert(title, message, type, relatedJobId);
  Alert.alert(title, message, [{ text: 'OK' }]);
}

export async function showSyncedConfirm(title: string, message: string, type: AlertPayload['type'] = 'warning', relatedJobId?: string): Promise<boolean> {
  syncAlert(title, message, type, relatedJobId);
  return showConfirm(title, message);
}
