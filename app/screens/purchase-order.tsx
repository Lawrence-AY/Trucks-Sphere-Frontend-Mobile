import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders, fetchDeliveryOrders } from '../../services/api';
import { formatEAT, formatCurrency, formatStatus, getStatusColor } from '../../utils/helpers';

export default function PurchaseOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [searchPo, setSearchPo] = useState(id || '');
  const [order, setOrder] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (poIdOrNumber: string) => {
    if (!poIdOrNumber) return;
    setLoading(true);
    setError('');

    try {
      // Try to find by ID first, then by Purchase Order number
      let orders = await fetchPurchaseOrders({ search: poIdOrNumber });
      let foundOrder = orders?.find(
        (o: any) => o.id === poIdOrNumber || (o.poNumber || '').toLowerCase() === poIdOrNumber.toLowerCase()
      );

      if (!foundOrder) {
        // Try broader search
        foundOrder = orders?.[0];
      }

      if (!foundOrder) {
        setError(`No purchase order found for: ${poIdOrNumber}`);
        setOrder(null);
        setDeliveries([]);
        setLoading(false);
        return;
      }

      setOrder(foundOrder);

      // Fetch linked delivery orders
      const dos = await fetchDeliveryOrders({ purchaseOrderId: foundOrder.id });
      setDeliveries(dos || []);
    } catch (e: any) {
      setError('Failed to load purchase order data');
      console.error(e);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      setSearchPo(id);
      loadData(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleSearch = () => {
    loadData(searchPo.trim());
  };

  const handleShare = async () => {
    if (!order) return;
    const msg = `PURCHASE ORDER #${order.poNumber}
Vendor: ${order.vendorName}
Material: ${order.materialName}
Quantity: ${order.quantity} ${order.unit}
Total: ${formatCurrency(order.totalAmount)}
Status: ${formatStatus(order.status)}
Trips Completed: ${deliveries.filter(d => d.status === 'delivered').length}/${deliveries.length}
Created: ${formatEAT(order.createdAt)}`;
    await Share.share({ message: msg, title: 'Purchase Order' });
  };

  const completedTrips = deliveries.filter(d => d.status === 'delivered').length;
  const totalDeliveredQty = deliveries.reduce((sum, d) => sum + (d.quantityDelivered || 0), 0);
  const remainingQty = Math.max(0, (order?.quantity || 0) - totalDeliveredQty);
  const progressPct = order?.quantity ? Math.min(100, (totalDeliveredQty / order.quantity) * 100) : 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Search Bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by Purchase Order (e.g. PO-2025-001)"
          placeholderTextColor={colors.textMuted}
          value={searchPo}
          onChangeText={setSearchPo}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleSearch}>
          <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading purchase order...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      {!loading && order && (
        <>
          {/* PO Receipt */}
          <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
            <View style={styles.receiptHeader}>
              <Ionicons name="document-text" size={28} color="#333" />
              <Text style={styles.receiptTitle}>PURCHASE ORDER</Text>
              <View style={styles.receiptLine} />
            </View>

            <View style={styles.receiptBody}>
              <Text style={styles.rHead}>{order.poNumber}</Text>
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <PORow label="Purchase Order Number" value={order.poNumber} bold />
              <PORow label="Vendor" value={order.vendorName} />
              <PORow label="Material" value={order.materialName} />
              <PORow label="Quantity" value={`${order.quantity} ${order.unit}`} />
              <PORow label="Unit Price" value={formatCurrency(order.unitPrice)} />
              <PORow label="Total Amount" value={formatCurrency(order.totalAmount)} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <PORow label="Quarry" value={order.quarryName} />
              <PORow label="Destination" value={order.siteName} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <PORow label="Created" value={formatEAT(order.createdAt)} />
              <PORow label="Updated" value={formatEAT(order.updatedAt)} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <View style={[styles.stamp, { backgroundColor: getStatusColor(order.status) + '15', borderColor: getStatusColor(order.status) }]}>
                <Text style={[styles.stampText, { color: getStatusColor(order.status) }]}>
                  {formatStatus(order.status).toUpperCase()}
                </Text>
              </View>

              <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
              <Text style={styles.rFooter}>Authorized Purchase Order</Text>
              <Text style={styles.rThanks}>TruckSphere Logistics</Text>
            </View>
          </View>

          {/* Progress Section */}
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: colors.text }]}>Delivery Progress</Text>
              <View style={styles.progressStats}>
                <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
                  {completedTrips}/{deliveries.length} trips
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round(progressPct))}%`, backgroundColor: progressPct >= 100 ? '#16A34A' : colors.accent }]} />
            </View>

            <View style={styles.progressDetails}>
              <View style={styles.progressDetailItem}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Ordered</Text>
                <Text style={[styles.progressValue, { color: colors.text }]}>{order.quantity} {order.unit}</Text>
              </View>
              <View style={styles.progressDetailItem}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Delivered</Text>
                <Text style={[styles.progressValue, { color: '#16A34A' }]}>{totalDeliveredQty} {order.unit}</Text>
              </View>
              <View style={styles.progressDetailItem}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Remaining</Text>
                <Text style={[styles.progressValue, { color: remainingQty > 0 ? '#D97706' : '#16A34A' }]}>{remainingQty} {order.unit}</Text>
              </View>
            </View>
          </View>

          {/* Delivery Orders */}
          {deliveries.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Linked Trips ({deliveries.length})
              </Text>
              {deliveries.map((d, i) => {
                const netWt = d.netWeight || (d.weighInWeight && d.weighOutWeight
                  ? (d.weighInWeight - d.weighOutWeight).toFixed(1) : '—');
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.deliveryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => router.push(`/screens/delivery-note?id=${d.jobId}`)}
                  >
                    <View style={styles.deliveryHeader}>
                      <Text style={[styles.deliveryJob, { color: colors.accent }]}>#{i + 1} · {d.jobId}</Text>
                      <View style={[styles.deliveryBadge, { backgroundColor: getStatusColor(d.status) + '15' }]}>
                        <Text style={[styles.deliveryBadgeText, { color: getStatusColor(d.status) }]}>
                          {formatStatus(d.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.deliveryRow}>
                      <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.deliveryText, { color: colors.textSecondary }]}>{d.driverName}</Text>
                    </View>
                    <View style={styles.deliveryRow}>
                      <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.deliveryText, { color: colors.textSecondary }]}>{d.plateNumber}</Text>
                    </View>
                    <View style={styles.deliveryRow}>
                      <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.deliveryText, { color: colors.textSecondary }]}>
                        {d.materialName} · Delivered: {d.quantityDelivered || 0} {order.unit} · Net: {netWt} t
                      </Text>
                    </View>
                    <Text style={[styles.deliveryTime, { color: colors.textMuted }]}>
                      {formatEAT(d.createdAt)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => router.back()}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!loading && !order && !error && (
        <View style={styles.emptyWrap}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Enter a Purchase Order number above to view details
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const PORow = ({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) => (
  <View style={styles.rRow}>
    <Text style={styles.rLabel}>{label}</Text>
    <Text style={[styles.rValue, bold && { fontWeight: '800' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  loadingText: { fontSize: 14, marginTop: Spacing.md },
  errorWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  errorText: { fontSize: 15, marginTop: Spacing.md, textAlign: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  emptyText: { fontSize: 15, marginTop: Spacing.md, textAlign: 'center' },
  // Receipt
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '800', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rDash: { textAlign: 'center', color: '#CCC', marginVertical: 4, fontSize: 11 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 12, color: '#666' },
  rValue: { fontSize: 13, color: '#333' },
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 10, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  // Progress
  progressCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  progressTitle: { fontSize: 15, fontWeight: '700' },
  progressStats: {},
  progressStat: { fontSize: 13 },
  progressBarBg: { height: 10, borderRadius: 5, marginBottom: Spacing.md, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  progressDetailItem: { alignItems: 'center' },
  progressLabel: { fontSize: 11 },
  progressValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  // Section
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  // Delivery cards
  deliveryCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  deliveryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  deliveryJob: { fontSize: 13, fontWeight: '700' },
  deliveryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  deliveryBadgeText: { fontSize: 10, fontWeight: '700' },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  deliveryText: { fontSize: 13 },
  deliveryTime: { fontSize: 11, marginTop: 4 },
  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  backText: { fontSize: 14, fontWeight: '600' },
});
