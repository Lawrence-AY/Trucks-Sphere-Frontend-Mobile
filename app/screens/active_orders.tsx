import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { MOCK_ORDERS } from '../../store/mockData';

export default function ActiveOrdersScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const orders = MOCK_ORDERS.filter((o) => o.vendorId === 'v1' && o.status !== 'completed').filter((o) =>
    (o.id || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search orders..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: '/screens/purchase-order', params: { id: item.id } })}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.id, { color: colors.accent }]}>{item.id}</Text>
              <Text style={[styles.status, { color: '#D97706' }]}>{item.status.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {item.material || item.materialName} - {item.quantity}T
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  id: { fontSize: 14, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '600' },
  text: { fontSize: 13 },
});
