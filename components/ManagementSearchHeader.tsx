import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Searchbar } from 'react-native-paper';
import { Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

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
  placeholder = 'Search...',
}: ManagementSearchHeaderProps) {
  const colors = useTheme();

  return (
    <Tabs.Screen
      options={{
        title,
        headerTitleAlign: 'left',
        headerTitleContainerStyle: styles.titleContainer,
        headerTitle: () => (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        ),
        headerRight: () => (
          <Searchbar
            placeholder={placeholder}
            value={search}
            onChangeText={onChangeSearch}
            autoCapitalize="none"
            style={[styles.search, { backgroundColor: colors.inputBg }]}
            inputStyle={[styles.searchInput, { color: colors.text }]}
          />
        ),
      }}
    />
  );
}

const styles = StyleSheet.create({
  titleContainer: { left: 6, right: 174 },
  title: { fontSize: 16, fontWeight: '700' },
  search: {
    width: 250,
    height: 38,
    marginRight: '20%',
    borderRadius: Radius.md,
    elevation: 0,
  },
  searchInput: { minHeight: 0, fontSize: 14 },
});
