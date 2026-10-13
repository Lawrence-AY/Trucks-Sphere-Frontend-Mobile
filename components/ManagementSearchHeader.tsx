import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Searchbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gap } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { ManagementHeaderMenuButton } from './management/ManagementMenuContext';
import { useDesktopWeb } from '../hooks/useDesktopWeb';

type ManagementSearchHeaderProps = {
  title: string;
  search: string;
  onChangeSearch: (value: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/** One responsive row: section icon, rounded search, and menu action. */
export function ManagementSearchHeader({ title, search, onChangeSearch, placeholder = 'Search', icon = 'business-outline' }: ManagementSearchHeaderProps) {
  if (Platform.OS === 'web') return <><Tabs.Screen options={{ headerShown: false }} /><ScreenSearchHeader title={title} search={search} onChangeSearch={onChangeSearch} placeholder={placeholder} icon={icon} /></>;
  return <Tabs.Screen options={{
    title,
    headerShown: true,
    header: () => <ScreenSearchHeader title={title} search={search} onChangeSearch={onChangeSearch} placeholder={placeholder} icon={icon} right={<ManagementHeaderMenuButton />} />,
  }} />;
}

/** Shared visual header for management and quarry navigator screens. */
export function ScreenSearchHeader({ title, search, onChangeSearch, placeholder = 'Search', icon = 'business-outline', left, right, hideSearch = false, safeArea = true }: ManagementSearchHeaderProps & { left?: React.ReactNode; right?: React.ReactNode; hideSearch?: boolean; safeArea?: boolean }) {
  const colors = useTheme();
  const desktop = useDesktopWeb();
  const insets = useSafeAreaInsets();
  const [headerWidth, setHeaderWidth] = useState(0);
  const compactWeb = Platform.OS === 'web' && headerWidth > 0 && headerWidth < 680;
  return <View style={{ backgroundColor: colors.surface, paddingTop: safeArea && Platform.OS !== 'web' ? insets.top : 0 }}>
      <View onLayout={event => setHeaderWidth(event.nativeEvent.layout.width)} style={[styles.row, desktop && { paddingHorizontal: 28, minHeight: 76, gap: 20 }, compactWeb && { paddingVertical: 10, gap: 8 }]}>
        {hideSearch ? <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: desktop ? 24 : 18, fontWeight: '700' }}>{title}</Text> : left ?? <View style={styles.icon} accessibilityLabel={title} accessibilityRole="image">
          <Ionicons name={icon} size={24} color={colors.text} />
        </View>}
        {!hideSearch && <Searchbar
          placeholder={placeholder}
          value={search}
          onChangeText={onChangeSearch}
          autoCapitalize="none"
          accessibilityLabel={`Search ${title}`}
          inputAccessoryViewID="trucksphere-keyboard-done"
          iconColor={colors.textMuted}
          placeholderTextColor={colors.textMuted}
          style={[styles.search, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          inputStyle={[styles.input, { color: colors.text }]}
        />}
        <View style={styles.actions}>{right ?? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/screens/notifications')} style={styles.icon}><Ionicons name="notifications-outline" size={24} color={colors.text} /></TouchableOpacity>}</View>
      </View>
    </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Gap, paddingHorizontal: 8, minHeight: 56 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actions: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  search: { flex: 1, minWidth: 0, height: 42, borderWidth: 1, borderRadius: 999, elevation: 0 },
  input: { minHeight: 0, fontSize: 14 },
});
