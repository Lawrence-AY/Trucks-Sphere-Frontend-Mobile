import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function SiteDashboardRedirect() {
  useEffect(() => {
    router.replace('/operator-site/dashboard' as any);
  }, []);
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5' }}><ActivityIndicator size="large" color="#1B2A4A" /></View>;
}