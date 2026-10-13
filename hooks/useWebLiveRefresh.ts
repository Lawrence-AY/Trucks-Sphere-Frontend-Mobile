import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Keep one-shot web lists current while visible, without overlapping requests. */
export function useWebLiveRefresh(refresh: () => void | Promise<void>, enabled = true) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const busy = useRef(false);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    let active = true;
    const run = async () => {
      if (!active || busy.current || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      busy.current = true;
      try { await callback.current(); } catch { /* Keep the last successful data visible. */ }
      finally { busy.current = false; }
    };
    void run();
    const timer = setInterval(run, 5000);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled]));
}
