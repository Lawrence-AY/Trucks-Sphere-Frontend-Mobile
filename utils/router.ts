import { router as expoRouter } from 'expo-router';

/**
 * Expo Router warns when GO_BACK is dispatched for a deep-linked screen with
 * no history. Keep the familiar router API while making Back history-only:
 * the user returns to the actual screen they came from, never a dashboard
 * redirect.
 */
function safeBack() {
  if (expoRouter.canGoBack()) {
    expoRouter.back();
  }
}

export const router = new Proxy(expoRouter, {
  get(target, key, receiver) {
    if (key === 'back') return safeBack;
    const value = Reflect.get(target, key, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof expoRouter;
