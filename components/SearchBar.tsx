import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/theme';
import { debounce } from '../utils/helpers';

interface FilterChip {
  label: string;
  value: string;
  active?: boolean;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  filters?: FilterChip[];
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
  debounceMs?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  onSearch,
  filters,
  onFilterChange,
  activeFilter,
  debounceMs = 400,
}) => {
  const colors = useTheme();
  const [searchText, setSearchText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedWidth = useRef(new Animated.Value(40)).current;
  const screenWidth = Dimensions.get('window').width;

  const debouncedSearch = useCallback(
    debounce((text: string) => {
      onSearch(text);
    }, debounceMs),
    [onSearch, debounceMs]
  );

  const handleChangeText = (text: string) => {
    setSearchText(text);
    debouncedSearch(text);
  };

  const toggleExpand = () => {
    const toValue = isExpanded ? 40 : screenWidth - Spacing['2xl'] * 2;
    Animated.spring(animatedWidth, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setSearchText('');
      onSearch('');
    }
  };

  const handleClear = () => {
    setSearchText('');
    onSearch('');
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.searchContainer,
          {
            width: animatedWidth,
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={handleChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={toggleExpand} style={styles.expandBtn}>
          <Ionicons
            name={isExpanded ? 'close' : 'search'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter Chips */}
      {filters && filters.length > 0 && isExpanded && (
        <View style={styles.filtersContainer}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.inputBg,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => onFilterChange?.(filter.value)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: isActive ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  {filter.label}
                </Text>
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#FFF"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingLeft: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    paddingHorizontal: Spacing.sm,
  },
  expandBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default SearchBar;
