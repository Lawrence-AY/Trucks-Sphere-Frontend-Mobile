import { Tabs, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

const BOTTOM_TABS = ['dashboard', 'orders', 'materials', 'settings'];

const TAB_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  dashboard: { icon: 'home-outline', label: 'Dashboard' },
  orders: { icon: 'document-text-outline', label: 'Orders' },
  materials: { icon: 'cube-outline', label: 'Materials' },
  settings: { icon: 'settings-outline', label: 'Settings' },
};

export default function VendorLayout() {
  const { logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B2A4A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : 6,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 68 + insets.bottom : 68,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/screens/issues' as any)} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
              <Ionicons name="notifications-outline" size={22} color="#1B2A4A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => logout()} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <Ionicons name="log-out-outline" size={20} color="#1B2A4A" />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      {BOTTOM_TABS.map((tabName) => {
        const config = TAB_ICONS[tabName];
        return (
          <Tabs.Screen
            key={tabName}
            name={tabName}
            options={{
              title: config?.label || tabName,
              tabBarLabel: config?.label || tabName,
              tabBarIcon: ({ color, focused }) => (
                <View style={[styles.tabIcon, focused && { backgroundColor: '#1B2A4A12' }]}>
                  <Ionicons name={config?.icon || 'ellipse'} size={22} color={color} />
                </View>
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 38,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});