import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders, fetchDeliveryOrders } from '../../services/api';
import { formatEAT, formatCurrency, formatStatus, getStatusColor } from '../../utils/helpers';

function PORow({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <View style={styles.rRow}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={[styles.rValue, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

export default function PurchaseOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [searchPo, setSearchPo] = useState(id || '');
  const [order, setOrder] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load order by ID or PO number
  const loadData = async (poIdOrNumber: string) => {
    if (!poIdOrNumber) return;
    setLoading(true);
    setError('');
    try {
      // Fetch all orders (or use empty search) – we'll filter locally
      const orders = await fetchPurchaseOrders({ search: '' });
      // Find by id first, then by poNumber
      const foundOrder = orders?.find(
        (o: any) =>
          o.id === poIdOrNumber ||
          o.poNumber === poIdOrNumber ||
          (o.poNumber || '').toLowerCase() === poIdOrNumber.toLowerCase()
      );
      if (foundOrder) {
        setOrder(foundOrder);
        // Fetch linked deliveries
        const dos = await fetchDeliveryOrders({ purchaseOrderId: foundOrder.id });
        setDeliveries(dos || []);
      } else {
        setError(`No purchase order found for: ${poIdOrNumber}`);
        setOrder(null);
        setDeliveries([]);
      }
    } catch (e: any) {
      setError('Failed to load purchase order data');
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

  const completedTrips = deliveries.filter(d => d.status === 'delivered').length;
  const totalDeliveredQty = deliveries.reduce((sum, d) => sum + (d.quantityDelivered || 0), 0);
  const remainingQty = Math.max(0, (order?.quantity || 0) - totalDeliveredQty);
  const progressPct = order?.quantity ? Math.min(100, (totalDeliveredQty / order.quantity) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search PO (e.g. PO-2026-001)"
            placeholderTextColor={colors.textMuted}
            value={searchPo}
            onChangeText={setSearchPo}
            onSubmitEditing={() => loadData(searchPo.trim())}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => loadData(searchPo.trim())}>
            <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: Spacing.md }}>Loading...</Text>
          </View>
        )}

        {Boolean(error) && !loading && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={{ fontSize: 14, color: colors.danger, textAlign: 'center', marginTop: Spacing.md }}>{error}</Text>
          </View>
        )}

        {!loading && order && (
          <>
            <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptHeader}>
                <Ionicons name="document-text" size={28} color={colors.primary} />
                <Text style={[styles.receiptTitle, { color: colors.text }]}>PURCHASE ORDER</Text>
              </View>
              <View style={styles.receiptBody}>
                <Text style={[styles.rHead, { color: colors.text }]}>{order.poNumber}</Text>
                <PORow label="Vendor" value={order.vendorName} />
                <PORow label="Material" value={order.materialName} />
                <PORow label="Quantity" value={`${order.quantity} ${order.unit}`} bold />
                <PORow label="Unit Price" value={formatCurrency(order.unitPrice)} />
                <PORow label="Total" value={formatCurrency(order.totalAmount)} bold />
                <PORow label="Quarry" value={order.quarryName} />
                <PORow label="Destination" value={order.siteName} />
                <PORow label="Created" value={formatEAT(order.createdAt)} />
                <View style={[styles.stamp, { backgroundColor: getStatusColor(order.status) + '15', borderColor: getStatusColor(order.status) }]}>
                  <Text style={[styles.stampText, { color: getStatusColor(order.status) }]}>{formatStatus(order.status).toUpperCase()}</Text>
                </View>
              </View>
            </View>

           

            {deliveries.length > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm }}>Linked Trips ({deliveries.length})</Text>
                {deliveries.map((d, i) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => router.push(`/screens/job-details?id=${d.jobId}` as any)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.accent }}>#{i + 1} · {d.jobId}</Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: getStatusColor(d.status) + '15' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: getStatusColor(d.status) }}>{formatStatus(d.status)}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{d.driverName} · {d.plateNumber}</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{d.materialName} · {d.quantityDelivered || 0} {order.unit}</Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{formatEAT(d.createdAt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.accent }]}
              onPress={async () => {
                if (!order) return;
                await Share.share({
                  message: `PO #${order.poNumber}\nVendor: ${order.vendorName}\nMaterial: ${order.materialName}\nQty: ${order.quantity} ${order.unit}\nTotal: ${formatCurrency(order.totalAmount)}\nStatus: ${formatStatus(order.status)}`,
                  title: 'Purchase Order'
                });
              }}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </>
        )}

        {!loading && !order && !error && (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }}>Enter a Purchase Order number above</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing['4xl'] },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm, marginBottom: Spacing.md },
  searchInput: { flex: 1, fontSize: 14 },
  center: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '700', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rDash: { textAlign: 'center', color: '#CCC', marginVertical: 4, fontSize: 11 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 14, color: '#666' },
  rValue: { fontSize: 14, color: '#333' },
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 14, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 14, color: '#666', marginTop: 4, fontStyle: 'italic' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, marginTop: Spacing.sm },
});