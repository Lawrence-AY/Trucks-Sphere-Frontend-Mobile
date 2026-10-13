import { useEffect } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import { BackHandler } from 'react-native';
import { bindBackNavigation, router } from '../utils/router';

export function BackNavigation() {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    const unbind = bindBackNavigation(navigation);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!router.canGoBack()) return false;
      router.back();
      return true;
    });
    return () => { subscription.remove(); unbind(); };
  }, [navigation]);
  return null;
}
