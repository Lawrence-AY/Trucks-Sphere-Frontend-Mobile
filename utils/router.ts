import { router as expoRouter } from 'expo-router';
import { getBackTarget } from './backNavigation';

let navigationRef: any;
export function bindBackNavigation(ref: any) {
  navigationRef = ref;
  return () => { if (navigationRef === ref) navigationRef = undefined; };
}

function canGoBack() {
  return navigationRef?.isReady()
    ? Boolean(getBackTarget(navigationRef.getRootState()))
    : expoRouter.canGoBack();
}

/**
 * Expo Router warns when GO_BACK is dispatched for a deep-linked screen with
 * no history. Keep the familiar router API while making Back history-only:
 * the user returns to the actual screen they came from, never a dashboard
 * redirect.
 */
function safeBack() {
  if (navigationRef?.isReady()) {
    const target = getBackTarget(navigationRef.getRootState());
    if (target) navigationRef.dispatch({ type: 'GO_BACK', target });
  } else if (expoRouter.canGoBack()) {
    expoRouter.back();
  }
}

export const router = new Proxy(expoRouter, {
  get(target, key, receiver) {
    if (key === 'back') return safeBack;
    if (key === 'canGoBack') return canGoBack;
    const value = Reflect.get(target, key, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof expoRouter;
