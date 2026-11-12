import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { fetchAllStockMovements, fetchStockMovements, fetchStocks } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { Gap } from '../../constants/theme';
import { SearchField } from '../../components/EnterpriseUI';
import { useMaterials } from '../../store/realtimeData';
import { formatStoreQuantity, isStoreNonBulkMaterial, storeMaterialUnit } from '../../utils/storeReceiving';

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isPieceUnit = (unit: unknown) => ['piece', 'pieces', 'pc', 'pcs'].includes(String(unit || '').trim().toLowerCase());

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
    ['dispatchedQuantity', 'receivedQuantity', 'usableQuantity', 'damagedQuantity', 'quarantinedQuantity', 'excessQuantity', 'shortageQuantity', 'consumedQuantity', 'movementUsedQuantity', 'remainingQuantity', 'receivedBasePieces', 'remainingBasePieces'].forEach((field) => {
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
  const materials = useMaterials();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchStocks(), fetchAllStockMovements().catch(() => null)]).then(async ([stocks, allMovements]) => {
      if (!active) return;
      const movements = allMovements || (await Promise.all(stocks.map((stock) => fetchStockMovements(String(stock.id)).catch(() => [])))).flat();
      if (!active) return;
      const movementTotals = new Map<string, number>();
      const stockById = new Map(stocks.map((stock) => [String(stock.id), stock]));
      movements.forEach((movement: any) => {
        if (movement.type !== 'usage') return;
        const stockId = String(movement.stockId);
        const stock = stockById.get(stockId);
        if (!stock) return;
        const quantityUnit = movement.quantityUnit || movement.unit;
        const quantity = number(movement.quantity);
        const converted = String(stock.unit || '').toLowerCase() === 'sets' && isPieceUnit(quantityUnit)
          ? quantity / Math.max(1, number(stock.piecesPerSet))
          : quantity;
        movementTotals.set(stockId, (movementTotals.get(stockId) || 0) + converted);
      });
      setItems(stocks.map((stock) => ({ ...stock, movementUsedQuantity: Math.max(number(stock.consumedQuantity), movementTotals.get(String(stock.id)) || 0) })));
    })
      .catch(() => { if (active) setError('Unable to load inventory. Reopen this screen to retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  const normalizedItems = useMemo(() => aggregateInventory(items.map((item: any) => {
    const material = materials.find((entry: any) =>
      [entry.id, entry.materialId].filter(Boolean).some((id: string) => String(id).toLowerCase() === String(item.materialId || '').toLowerCase())
      || (entry.name || entry.materialName) && String(entry.name || entry.materialName).trim().toLowerCase() === String(item.materialName || '').trim().toLowerCase(),
    );
    const enriched = { ...material, ...item, category: item.category || material?.category, materialCategory: item.materialCategory || material?.category };
    const unit = storeMaterialUnit(enriched, item.unit || '');
    return { ...enriched, unit };
  }).filter((item: any) =>
    isStoreNonBulkMaterial(item) &&
    (['inventory_added', 'inspected - pass', 'partially accepted'].includes(String(item.receiptStatus || '').toLowerCase()) || Boolean(item.inspectedAt && item.mifNumber)) &&
    !['Dispatched', 'Accepted - awaiting receiving', 'Accepted - awaiting inspection', 'received_pending_inspection', 'receiving_rejected', 'inspection_rejected'].includes(item.receiptStatus),
  )), [items, materials]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return normalizedItems;
    return normalizedItems.filter(item => [item.materialName, item.siteName, item.siteId, item.unit, item.receiptStatus].some(value => String(value || '').toLowerCase().includes(query)));
  }, [normalizedItems, search]);
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  if (error) return <Text style={{ color: colors.danger, padding: 20 }}>{error}</Text>;
  return <FlatList
    style={{ backgroundColor: colors.background }}
    contentContainerStyle={styles.page}
    data={filteredItems}
    keyExtractor={(item, index) => item.id || `${item.materialId || item.materialName}-${index}`}
    ListHeaderComponent={<View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>Inventory</Text><Text style={{ color: colors.textMuted }}>{filteredItems.length} material {filteredItems.length === 1 ? 'record' : 'records'}</Text></View><SearchField title="Inventory" icon="layers-outline" value={search} onChangeText={setSearch} placeholder="Search material, site or unit" /></View>}
    ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name={search ? 'search-outline' : 'cube-outline'} size={28} color={colors.textMuted} /><Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>{search ? 'No matching stock' : 'No stock records'}</Text><Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>{search ? 'Try another material, site or unit.' : 'Inspected materials will appear here.'}</Text></View>}
    renderItem={({ item }) => {
      const available = item.unit === 'sets'
        ? `${item.remainingSets ?? Math.floor((item.remainingBasePieces || 0) / Math.max(1, item.piecesPerSet || 1))} sets + ${item.remainingLoosePieces ?? 0} pcs`
        : `${formatStoreQuantity(item.remainingQuantity ?? 0, item.unit || '')} ${item.unit || ''}`;
      return <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(`/store-account/inventory/${item.id}` as any)}>
        <View style={styles.cardTop}><View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}><Ionicons name="cube-outline" size={18} color={colors.primary} /></View><View style={styles.materialInfo}><Text style={[styles.name, { color: colors.text }]}>{item.materialName || 'Material'}</Text></View><View style={styles.available}><Text style={[styles.availableLabel, { color: colors.textMuted }]}>AVAILABLE</Text><Text style={[styles.value, { color: colors.primary }]} numberOfLines={2}>{available}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></View>
        <View style={[styles.footer, { borderTopColor: colors.border }]}><Text style={[styles.meta, { color: colors.textMuted }]}>Received {formatStoreQuantity(item.receivedQuantity ?? 0, item.unit || '')} {item.unit || ''}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Used {formatStoreQuantity(Math.max(number(item.consumedQuantity), number(item.movementUsedQuantity)), item.unit || '')} {item.unit || ''}</Text></View>
      </TouchableOpacity>;
    }}
  />;
}

const styles = StyleSheet.create({ page: { padding: 16, gap: Gap }, header: { gap: 14, marginBottom: 4 }, title: { fontSize: 26, fontWeight: '800', marginBottom: 4 }, card: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 2 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 }, iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, materialInfo: { flex: 1, minWidth: 0 }, name: { fontSize: 15, fontWeight: '800' }, available: { minWidth: 76, maxWidth: '42%', alignItems: 'flex-end' }, availableLabel: { fontSize: 9, fontWeight: '700' }, value: { fontSize: 14, fontWeight: '900', textAlign: 'right' }, meta: { fontSize: 11 }, footer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, marginTop: 6 }, empty: { alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 24 } });
