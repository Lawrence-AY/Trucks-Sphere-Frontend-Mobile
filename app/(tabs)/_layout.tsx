import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

type TabName = string;

const BOTTOM_TABS: TabName[] = ['dashboard', 'active', 'orders', 'materials', 'vendors'];
const HIDDEN_TABS: TabName[] = ['drivers', 'search', 'history', 'profile', 'trucks'];

const TAB_ICONS: Record<string, { icon: any; label: string; family: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', family: 'MaterialIcons' },
  active: { icon: 'activity', label: 'Active', family: 'Feather' },
  materials: { icon: 'cube', label: 'Materials', family: 'Ionicons' },
  drivers: { icon: 'people', label: 'Drivers', family: 'Ionicons' },
  search: { icon: 'search', label: 'Search', family: 'Ionicons' },
  history: { icon: 'time', label: 'History', family: 'Ionicons' },
  profile: { icon: 'person', label: 'Profile', family: 'Ionicons' },
  trucks: { icon: 'car', label: 'Trucks', family: 'Ionicons' },
  orders: { icon: 'document-text', label: 'Orders', family: 'Ionicons' },
  vendors: { icon: 'storefront', label: 'Vendors', family: 'Ionicons' },
};

const getTabIcon = (name: string, focused: boolean, color: string) => {
  const config = TAB_ICONS[name];
  if (!config) return <Ionicons name="ellipse" size={24} color={color} />;
  const size = 24;
  switch (config.family) {
    case 'MaterialIcons':
      return <MaterialIcons name={config.icon as any} size={size} color={color} />;
    case 'Feather':
      return <Feather name={config.icon as any} size={size} color={color} />;
    default:
      return <Ionicons name={config.icon as any} size={size} color={color} />;
  }
};

export default function TabsLayout() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);

  // Floating tab bar style – properly typed with `as const` for display
  const floatingTabBarStyle: ViewStyle = Platform.select({
    web: { display: 'none' as const },
    default: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 20,
      borderRadius: 25,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 7,
      paddingHorizontal: 4,
      paddingBottom: bottomInset + 4,
      height: 72 + bottomInset,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
  }) as ViewStyle; // Cast to satisfy the union type

  return (
    <Tabs
      tabBar={Platform.OS === 'web' ? () => null : undefined}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: Platform.OS !== 'web',
        headerShown: Platform.OS !== 'web',
        tabBarLabelStyle: Platform.OS === 'web' ? { display: 'none' } : styles.tabBarLabel,
        tabBarStyle: floatingTabBarStyle,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        headerLeft: Platform.OS === 'ios' ? () => <View style={{ width: 8 }} /> : undefined,
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
                <View
                  style={[
                    styles.tabIconWrap,
                    focused && { backgroundColor: colors.primary + '12' },
                  ]}
                >
                  {getTabIcon(tabName, focused, focused ? colors.primary : colors.textSecondary)}
                </View>
              ),
            }}
          />
        );
      })}
      {Platform.OS !== 'web' &&
        HIDDEN_TABS.map((tabName) => (
          <Tabs.Screen key={tabName} name={tabName} options={{ href: null }} />
        ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0,
  },
  tabIconWrap: {
    width: 42,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});