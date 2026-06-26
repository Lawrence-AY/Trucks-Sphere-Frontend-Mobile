import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  TextInput, SectionList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders } from '../../services/api';
import { formatEAT, formatCurrency, getStatusColor, formatStatus } from '../../utils/helpers';

export default function OrdersScreen() {
  const colors = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchPurchaseOrders();
      setOrders(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Group orders by vendor
  const groupedOrders = useMemo(() => {
    const filtered = orders.filter((o) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (o.poNumber || '').toLowerCase().includes(q) ||
        (o.vendorName || '').toLowerCase().includes(q) ||
        (o.materialName || '').toLowerCase().includes(q)
      );
    });

    const groups: Record<string, any[]> = {};
    filtered.forEach((o) => {
      const vendor = o.vendorName || 'Unknown Vendor';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(o);
    });

    return Object.entries(groups)
      .map(([vendor, items]) => ({
        title: vendor,
        data: items,
        totalAmount: items.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
        orderCount: items.length,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [orders, search]);

  const renderSectionHeader = ({ section }: { section: any }) => {
    const statusCounts: Record<string, number> = {};
    section.data.forEach((o: any) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    return (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <View style={styles.sectionHeaderTop}>
          <View style={[styles.vendorAvatar, { backgroundColor: colors.primary + '12' }]}>
            <Text style={[styles.vendorAvatarText, { color: colors.primary }]}>
              {section.title.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.sectionHeaderInfo}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
              {section.orderCount} order{section.orderCount !== 1 ? 's' : ''} · {formatCurrency(section.totalAmount)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.statusRow}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <View key={status} style={[styles.statusChip, { backgroundColor: getStatusColor(status) + '12' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
              <Text style={[styles.statusChipText, { color: getStatusColor(status) }]}>
                {formatStatus(status)} ({count})
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: getStatusColor(item.status) + '12' }]}>
          <Ionicons name="document-text" size={18} color={getStatusColor(item.status)} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.poNumber, { color: colors.text }]}>{item.poNumber}</Text>
          <Text style={[styles.material, { color: colors.textSecondary }]}>
            {item.materialName} · {item.quantity} {item.unit}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatStatus(item.status).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Ionicons name="cash-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            {item.quarryName} → {item.siteName}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardTime, { color: colors.textTertiary }]}>
        {formatEAT(item.createdAt)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by PO, vendor, material..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={groupedOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="document-text-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  sectionHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderTop: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  vendorAvatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  vendorAvatarText: { fontSize: 18, fontWeight: '700' },
  sectionHeaderInfo: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionMeta: { fontSize: 12, marginTop: 1 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: Radius.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusChipText: { fontSize: 10, fontWeight: '600' },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  poNumber: { fontSize: 14, fontWeight: '700' },
  material: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBody: { gap: 5, marginTop: Spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardText: { fontSize: 13 },
  cardTime: { fontSize: 11, marginTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
