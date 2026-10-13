import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

export function WorkspaceHeader({ collapsed, onToggleSidebar }: { collapsed: boolean; onToggleSidebar: () => void }) {
  const colors = useTheme();
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const format = (text: string) => text.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  return <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={collapsed ? 'Expand sidebar' : 'Minimize sidebar'} accessibilityState={{ expanded: !collapsed }} onPress={onToggleSidebar} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} size={22} color={colors.text} />
    </TouchableOpacity>
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{format(parts[0] || 'Workspace')} <Text style={{ color: colors.text }}> / {format(parts[1] || 'Overview')}{parts.length > 2 ? ' / Details' : ''}</Text></Text>
    <View style={{ flex: 1 }} />
  </View>;
}
const styles = StyleSheet.create({
  bar: { height: 64, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, borderBottomWidth: 1, gap: 20 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
