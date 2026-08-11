import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';

interface Tab {
  name: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  tone?: 'danger';
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabName: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const colors = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const active = tab.name === activeTab;
          const danger = tab.tone === 'danger';
          const color = danger ? '#B91C1C' : active ? '#FFFFFF' : colors.textSecondary;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => onTabChange(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? (danger ? '#B91C1C' : colors.primary) : colors.surface,
                  borderColor: active ? (danger ? '#B91C1C' : colors.primary) : (danger ? '#FECACA' : colors.border),
                },
              ]}
            >
              {tab.icon ? <Ionicons name={tab.icon} size={17} color={color} /> : null}
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {tab.count === undefined ? tab.label : `${tab.label} (${tab.count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    width: 180,
    minWidth: 180,
    maxWidth: 180,
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    paddingHorizontal: Spacing.md,
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
