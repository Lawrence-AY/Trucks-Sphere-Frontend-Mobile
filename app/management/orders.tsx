import { useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, TextInput, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { usePurchaseOrders } from '../../store/realtimeData';
import { fetchMaterials } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { DataCard, DetailRow, EmptyState, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';
import { useAuthStore } from '../../store/authStore';
import { hasManagementPermission } from '../../utils/access';

export default function ManagementOrdersScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canCreatePurchaseOrder = hasManagementPermission(user?.role, 'purchaseOrders.create');
  const [search, setSearch] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialFilter, setMaterialFilter] = useState('');
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useRealTimeSyncStore((s) => s.refresh);

  useEffect(() => { fetchMaterials().then(m => setMaterials(m || [])).catch(() => {}); }, []);

  const orders = usePurchaseOrders();

  // Refresh purchase orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh('purchaseOrders');
    }, [refresh])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('purchaseOrders');
    setRefreshing(false);
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item: any) => {
      const matchesSearch = !query || [item.poNumber, item.vendorName, item.materialName]
        .some((v: any) => String(v || '').toLowerCase().includes(query));
      const matchesFilter = true;
      const matchesMaterial = !materialFilter || item.materialId === materialFilter;
      return matchesSearch && matchesFilter && matchesMaterial;
    });
  }, [orders, search, materialFilter]);

  const matFiltered = matSearch.trim()
    ? materials.filter(m => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materials;

  const selectedMaterial = materials.find(m => m.id === materialFilter);

  return (
    <View style={styles.shell}>
      <PageShell
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />

        {/* Material Dropdown Filter */}
        <View style={{ marginBottom: Spacing.sm }}>
          <TouchableOpacity
            style={[styles.matBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => { setMatDropdownOpen(!matDropdownOpen); setMatSearch(''); }}
          >
            <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.matBtnText, { color: selectedMaterial ? colors.text : colors.textMuted }]} numberOfLines={1}>
              {selectedMaterial ? selectedMaterial.name : 'Filter by material...'}
            </Text>
            {materialFilter ? (
              <TouchableOpacity onPress={() => setMaterialFilter('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name={matDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>
          {matDropdownOpen && (
            <View style={[styles.matDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.matSearchRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput style={[styles.matSearchInput, { color: colors.text }]} placeholder="Search materials..." placeholderTextColor={colors.textMuted} value={matSearch} onChangeText={setMatSearch} autoFocus />
              </View>
              <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                {matFiltered.map((m: any) => (
                  <TouchableOpacity key={m.id} style={[styles.matItem, m.id === materialFilter && { backgroundColor: (colors as any).accent + '15' }]} onPress={() => { setMaterialFilter(m.id); setMatDropdownOpen(false); }}>
                    <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                    {m.id === materialFilter && <Ionicons name="checkmark" size={16} color={(colors as any).accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <SectionTitle title={`${filtered.length} purchase orders`} />

        {filtered.length > 0 ? (
          filtered.map((item: any) => (
            <DataCard key={item.id} onPress={() => router.push(`/management/purchase-orders/${item.id}` as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName}</Text>
                </View>
              </View>
              <DetailRow icon="cube-outline" value={`${item.materialName} · ${item.quantity || 0} ${item.unit || 'units'}`} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
            </DataCard>
          ))
        ) : (
          <EmptyState icon="document-text-outline" title="No orders found" subtitle="Adjust the search or filter." />
        )}
      </PageShell> 

      {canCreatePurchaseOrder && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/management/purchase-orders/create' as any)} activeOpacity={0.85} accessibilityLabel="Create purchase order">
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  matBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  matBtnText: { flex: 1, fontSize: 14 },
  matDropdown: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  matSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  matSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
  matItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
});
