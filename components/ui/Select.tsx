import React, { useMemo, useState } from 'react';
import { FlatList, Modal as NativeModal, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Divider,
  HelperText,
  IconButton,
  List,
  Modal,
  Portal,
  Searchbar,
  Text,
  TextInput as PaperTextInput,
  TouchableRipple,
} from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';

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
  nativeModal?: boolean;
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
  nativeModal = false,
}: SelectProps) {
  const colors = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      option.name.toLowerCase().includes(query) || option.subtitle?.toLowerCase().includes(query)
    );
  }, [options, search]);

  const open = () => {
    setSearch('');
    setVisible(true);
  };

  const optionsContent = (
    <>
      <View style={styles.modalHeader}>
        <Text variant="titleLarge">Select {label}</Text>
        <IconButton icon="close" onPress={() => setVisible(false)} />
      </View>
      {searchable ? (
        <Searchbar
          placeholder={`Search ${label.toLowerCase()}...`}
          value={search}
          onChangeText={setSearch}
          autoFocus
          style={styles.search}
          inputStyle={styles.searchInput}
        />
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={item.subtitle}
            titleNumberOfLines={2}
            descriptionNumberOfLines={1}
            onPress={() => {
              onSelect(item.id);
              setVisible(false);
            }}
            right={() => item.id === value ? <List.Icon icon="check" color={colors.primary} /> : null}
          />
        )}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={colors.textMuted} />
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              No {label.toLowerCase()} found
            </Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
    </>
  );

  return (
    <View style={styles.container}>
      <TouchableRipple onPress={open} borderless>
        <View pointerEvents="none">
          <PaperTextInput
            mode="outlined"
            label={required ? `${label} *` : label}
            value={selected?.name ?? ''}
            placeholder={placeholder || `Select ${label}...`}
            placeholderTextColor={colors.textMuted}
            editable={false}
            error={Boolean(error)}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={selected ? colors.text : colors.textMuted}
            dense
            left={icon ? <PaperTextInput.Icon icon={({ color, size }) => <Ionicons name={icon} color={color} size={size} />} /> : undefined}
            right={<PaperTextInput.Icon icon={({ color, size }) => <Ionicons name="chevron-down" color={color} size={size} />} />}
          />
        </View>
      </TouchableRipple>
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}

      {nativeModal ? (
        <NativeModal
          visible={visible}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={() => setVisible(false)}
        >
          <View style={styles.nativeModalOverlay}>
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              {optionsContent}
            </View>
          </View>
        </NativeModal>
      ) : (
        <Portal>
          <Modal
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
          >
            {optionsContent}
          </Modal>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  modal: {
    marginHorizontal: Spacing.md,
    maxHeight: '78%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  search: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    minHeight: 0,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing['3xl'],
  },
  nativeModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});
