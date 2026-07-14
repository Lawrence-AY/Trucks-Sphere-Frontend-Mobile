import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

interface Tab {
  name: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabName: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const colors = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const isActive = tab.name === activeTab;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onTabChange(tab.name)}
            activeOpacity={0.7}
          >
            {tab.icon && (
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? '#FFFFFF' : colors.textMuted}
              />
            )}
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && (
              <View
                style={[
                  styles.count,
                  { backgroundColor: isActive ? '#FFFFFF30' : colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    { color: isActive ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  content: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  count: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
