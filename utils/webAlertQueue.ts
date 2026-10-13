import { Alert, Platform } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

export interface WebAlertDialog {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

let sequence = 0;
let queue: WebAlertDialog[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeWebAlerts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getWebAlert = () => queue[0] || null;
export const getServerWebAlert = () => null;

export function enqueueWebAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  if (typeof window === 'undefined') return;
  queue = [...queue, {
    id: ++sequence, title, message,
    buttons: buttons?.length ? buttons.map((button) => ({ ...button })) : [{ text: 'OK' }],
    options,
  }];
  notify();
}

export function selectWebAlertButton(id: number, index: number): void {
  const alert = getWebAlert();
  if (!alert || alert.id !== id || !alert.buttons[index]) return;
  const button = alert.buttons[index];
  queue = queue.slice(1);
  notify();
  button.onPress?.();
}

export function dismissWebAlert(id: number, viaEscape = false): void {
  const alert = getWebAlert();
  if (!alert || alert.id !== id) return;
  const cancelIndex = alert.buttons.findIndex((button) => button.style === 'cancel');
  if (viaEscape && cancelIndex !== -1) {
    selectWebAlertButton(id, cancelIndex);
  } else if (alert.options?.cancelable) {
    queue = queue.slice(1);
    notify();
    alert.options.onDismiss?.();
  }
}

/** Cover existing Alert.alert calls app-wide, while keeping native behavior. */
export function installWebAlertBridge(): void {
  if (Platform.OS === 'web') Alert.alert = enqueueWebAlert;
}
