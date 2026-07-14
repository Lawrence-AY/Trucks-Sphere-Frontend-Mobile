import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

interface SelectOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (id: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
}

export function Select({
  label,
  value,
  options,
  onSelect,
  icon,
  error,
  required = false,
  placeholder,
  searchable = true,
}: SelectProps) {
  const colors = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.id === value);
  const filtered = search.trim()
    ? options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  return (
    <>
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {label}
          {required && <Text style={{ color: colors.danger }}> *</Text>}
        </Text>
        <TouchableOpacity
          style={[
            styles.trigger,
            {
              borderColor: error ? colors.danger : colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          onPress={() => {
            setVisible(true);
            setSearch('');
          }}
          activeOpacity={0.7}
        >
          {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
          <Text
            style={[
              styles.triggerText,
              { color: selected ? colors.text : colors.textMuted + '80' },
            ]}
            numberOfLines={1}
          >
            {selected ? selected.name : placeholder || `Select ${label}...`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {error && (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        )}
      </View>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select {label}
            </Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {searchable && (
            <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  item.id === value && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => {
                  onSelect(item.id);
                  setVisible(false);
                }}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionName,
                      { color: colors.text },
                      item.id === value && { fontWeight: '700' },
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  {item.subtitle && (
                    <Text
                      style={[styles.optionSubtitle, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                {item.id === value && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No {label.toLowerCase()} found
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 40,
  },
});
