import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { fetchStocks } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

export default function InventoryScreen() {
  const colors = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchStocks().then(setItems).finally(() => setLoading(false)); }, []);
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  return <FlatList style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} data={items} keyExtractor={(item) => item.id} ListHeaderComponent={<Text style={[styles.title, { color: colors.text }]}>Inventory</Text>} ListEmptyComponent={<Text style={{ color: colors.textMuted }}>No stock records available.</Text>} renderItem={({ item }) => <TouchableOpacity activeOpacity={0.8} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(`/store-account/inventory/${item.id}` as any)}><Text style={[styles.name, { color: colors.text }]}>{item.materialName || 'Material'}</Text><Text style={{ color: colors.textMuted }}>{item.siteName || 'Unassigned'} · {item.unit || ''}</Text><View style={styles.row}><Text style={{ color: colors.text }}>Available</Text><Text style={[styles.value, { color: colors.primary }]}>{item.remainingQuantity ?? 0}</Text></View><Text style={{ color: colors.textMuted }}>Received: {item.receivedQuantity ?? 0} · Used: {item.consumedQuantity ?? 0}</Text></TouchableOpacity>} />;
}

const styles = StyleSheet.create({ page: { padding: 20, gap: 12 }, title: { fontSize: 26, fontWeight: '800', marginBottom: 8 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 }, name: { fontSize: 17, fontWeight: '800', marginBottom: 5 }, row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }, value: { fontSize: 20, fontWeight: '800' } });
