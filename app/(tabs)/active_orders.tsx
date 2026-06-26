import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_ORDERS } from '../../store/mockData';
import { router } from 'expo-router';

export default function ActiveOrdersScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const orders = MOCK_ORDERS.filter(o => o.vendorId === 'v1' && o.status !== 'completed').filter(o =>
    (o.id || '').toLowerCase().includes((search || '').toLowerCase())
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search orders..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
      </View>
      <FlatList data={orders} keyExtractor={o => o.id} contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/screens/purchase-order?id=' + item.id)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.id, { color: colors.accent }]}>{item.id}</Text>
              <Text style={[styles.status, { color: '#D97706' }]}>{item.status.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.text, { color: colors.textSecondary }]}>{item.material} — {item.quantity}T</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 }, card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8 },
  id: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, fontWeight: '600' }, text: { fontSize: 13 },
});
