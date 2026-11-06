import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { fetchStocks } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { Gap } from '../../constants/theme';
import { isBulkMaterial } from '../../utils/warehouse';

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function aggregateInventory(stocks: any[]) {
  const grouped = new Map<string, any>();
  stocks.forEach((item) => {
    const key = [item.siteId || item.siteName || '', item.materialId || item.materialName || '', item.unit || ''].join('|').toLowerCase();
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...item, sourceStockIds: [item.id] });
      return;
    }
    current.sourceStockIds.push(item.id);
    ['dispatchedQuantity', 'receivedQuantity', 'usableQuantity', 'damagedQuantity', 'quarantinedQuantity', 'excessQuantity', 'shortageQuantity', 'consumedQuantity', 'remainingQuantity', 'receivedBasePieces', 'remainingBasePieces'].forEach((field) => {
      current[field] = number(current[field]) + number(item[field]);
    });
    if (current.remainingSets != null || item.remainingSets != null) current.remainingSets = Math.floor(number(current.remainingBasePieces) / Math.max(1, number(current.piecesPerSet || item.piecesPerSet)));
    if (current.remainingLoosePieces != null || item.remainingLoosePieces != null) current.remainingLoosePieces = number(current.remainingBasePieces) % Math.max(1, number(current.piecesPerSet || item.piecesPerSet));
    current.receiptStatus = current.receiptStatus === item.receiptStatus ? current.receiptStatus : 'Inspected - Pass';
  });
  return [...grouped.values()];
}

export default function InventoryScreen() {
  const colors = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchStocks().then((stocks) => { if (active) setItems(aggregateInventory(stocks.filter((item: any) =>
      (String(item.origin || '').toLowerCase() === 'warehouse' || !isBulkMaterial(item)) &&
      !['Dispatched', 'Accepted - awaiting receiving', 'Accepted - awaiting inspection', 'received_pending_inspection', 'receiving_rejected', 'inspection_rejected'].includes(item.receiptStatus),
    ))); })
      .catch(() => { if (active) setError('Unable to load inventory. Reopen this screen to retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  if (error) return <Text style={{ color: colors.danger, padding: 20 }}>{error}</Text>;
  return <FlatList style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} data={items} keyExtractor={(item) => item.id} ListHeaderComponent={<Text style={[styles.title, { color: colors.text }]}>Inventory</Text>} ListEmptyComponent={<Text style={{ color: colors.textMuted }}>No stock records available.</Text>} renderItem={({ item }) => <TouchableOpacity activeOpacity={0.8} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(`/store-account/inventory/${item.id}` as any)}><Text style={[styles.name, { color: colors.text }]}>{item.materialName || 'Material'}</Text><Text style={{ color: colors.textMuted }}>{item.siteName || 'Unassigned'} · {item.unit || ''}</Text><View style={styles.row}><Text style={{ color: colors.text }}>Available</Text><Text style={[styles.value, { color: colors.primary }]}>{item.unit === 'sets' ? `${item.remainingSets ?? Math.floor((item.remainingBasePieces || 0) / item.piecesPerSet)} Sets + ${item.remainingLoosePieces ?? ((item.remainingBasePieces || 0) % item.piecesPerSet)} Pieces` : `${item.remainingQuantity ?? 0} ${item.unit || ''}`}</Text></View>{item.unit === 'sets' ? <Text style={{ color: colors.textMuted }}>{item.remainingBasePieces ?? item.receivedBasePieces ?? 0} Total Pieces</Text> : null}<Text style={{ color: colors.textMuted }}>Received: {item.receivedQuantity ?? 0} · Used: {item.consumedQuantity ?? 0}</Text></TouchableOpacity>} />;
}

const styles = StyleSheet.create({ page: { padding: 20, gap: Gap}, title: { fontSize: 26, fontWeight: '800', marginBottom: 8 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 }, name: { fontSize: 17, fontWeight: '800', marginBottom: 5 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginTop: 14 }, value: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '800', textAlign: 'right' } });
