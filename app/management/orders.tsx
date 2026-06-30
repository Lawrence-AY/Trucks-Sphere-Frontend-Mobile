import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { usePurchaseOrders } from '../../store/realtimeData';
import { formatCurrency, formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

export default function ManagementOrdersScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  // ===== Real-time Firebase data via onSnapshot =====
  const orders = usePurchaseOrders();

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item) => {
      const matchesSearch = !query || [item.poNumber, item.vendorName, item.materialName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFilter = filter === 'all' || item.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, orders, search]);

  const summary = useMemo(() => {
    const ordered = orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const delivered = orders.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
    return {
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
      completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
      value: orders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    };
  }, [orders]);

  return (
    <PageShell>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <SectionTitle title={`${filtered.length} purchase orders`} />
      {filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName}</Text>
              </View>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="cube-outline" value={`${item.materialName} · ${item.quantity || 0} ${item.unit || 'units'}`} />
            <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} → ${item.siteName || 'Destination'}`} />
            <DetailRow icon="cash-outline" value={formatCurrency(item.totalAmount || 0)} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="document-text-outline" title="No orders found" subtitle="Adjust the search or filter." />
      )}
    </PageShell>
  );
}