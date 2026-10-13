import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';

export default function WeighInLayout() {
  const colors = useTheme();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerShadowVisible: false }}>
    <Stack.Screen name="[id]" options={{ title: 'Site weigh-in', headerLeft: () => (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to schedule" onPress={() => router.replace('/operator-site/schedule' as any)} style={{ padding: 8, marginRight: 8 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
    ) }} />
  </Stack>;
}
