import React from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Searchbar } from 'react-native-paper';
import { Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { ManagementHeaderMenuButton } from './management/ManagementMenuContext';

type ManagementSearchHeaderProps = {
  title: string;
  search: string;
  onChangeSearch: (value: string) => void;
  placeholder?: string;
};

/** Keeps management list titles visible while placing search in the header. */
export function ManagementSearchHeader({
  title,
  search,
  onChangeSearch,
}: ManagementSearchHeaderProps) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(0, width - 68);

  return (
    <Tabs.Screen
      options={{
        title,
        headerLeft: () => (
          <View style={[styles.leftGroup, { width: availableWidth }]}>
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Searchbar
              placeholder="Search"
              value={search}
              onChangeText={onChangeSearch}
              autoCapitalize="none"
              accessibilityLabel={`Search ${title}`}
              style={[styles.search, { backgroundColor: colors.inputBg }]}
              inputStyle={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        ),
        headerTitle: () => null,
        headerRight: () => <ManagementHeaderMenuButton />,
      }}
    />
  );
}

const styles = StyleSheet.create({
  leftGroup: { marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { width: '30%', flexShrink: 1, fontSize: 14, fontWeight: '700' },
  search: {
    flex: 1,
    minWidth: 0,
    height: 38,
    marginRight: 0,
    borderRadius: Radius.md,
    elevation: 0,
  },
  searchInput: { minHeight: 0, fontSize: 14 },
});
