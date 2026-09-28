import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { fetchWarehouseJobs } from '../../services/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { WarehouseJob } from '@/store/types';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';
import { formatEAT } from '../../utils/helpers';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
] as const;
type HistoryFilter = typeof FILTERS[number]['id'];

function poReference(job: WarehouseJob) {
  return job.poNumber || String(job.warehouseReference || '').split('/').slice(0, 2).join('/');
}

function shipmentLocation(job: any) {
  return job.location || job.siteName || job.deliveryLocation || 'Warehouse';
}

function shipmentCompany(job: any) {
  return job.companyName || job.vendorName || 'N/A';
}

function shipmentTimestamp(job: WarehouseJob) {
  return job.warehouseAcceptedAt || job.dispatchedToSiteAt || job.submittedAt || job.updatedAt || job.createdAt;
}

function shipmentOperator(job: WarehouseJob) {
  return job.createdByName || job.warehouseAcceptedByName || String(job.createdBy || '').trim() || 'N/A';
}

function totalDispatchedItems(job: WarehouseJob) {
  if (Number.isFinite(Number(job.itemCount)) && Number(job.itemCount) > 0) return Number(job.itemCount);
  return (job.items || []).length;
}

function originatingWarehouse(job: any) {
  return job.sourceWarehouse || job.warehouseName || job.goodsDeliveryNoteSource || job.deliveryOrigin || 'Warehouse';
}

function statusLabel(status?: string) {
  if (status === 'INSPECTED') return 'Completed';
  if (status === 'ACCEPTED') return 'Accepted';
  return 'Submitted';
}

export default function WarehouseHistoryScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('today');
  const [selectedShipment, setSelectedShipment] = useState<WarehouseJob | null>(null);

  const load = useCallback(async () => {
    const records = await fetchWarehouseJobs();
    setJobs(records as WarehouseJob[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const myJobs = useMemo(() => jobs.filter((job) => job.createdByUid === user?.uid), [jobs, user?.uid]);
  const filteredJobs = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (filter === 'today') start.setHours(0, 0, 0, 0);
    if (filter === 'week') start.setDate(now.getDate() - 6);
    if (filter === 'month') start.setMonth(now.getMonth() - 1);
    return myJobs.filter((job) => {
      const date = shipmentTimestamp(job);
      return date && new Date(date) >= start;
    });
  }, [filter, myJobs]);
  const downloadCsv = async () => {
    setDownloading(true);
    try {
      await shareCsvAsFile('Warehouse_Shipment_History', buildCsvContent(
        ['Job ID', 'Purchase Order', 'Vendor', 'Status', 'Timestamp', 'Operator', 'Total Dispatched Items', 'Originating Warehouse', 'Products'],
        filteredJobs.map((job) => [
          job.jobId,
          poReference(job),
          job.vendorName,
          job.status,
          shipmentTimestamp(job) || '',
          shipmentOperator(job),
          String(totalDispatchedItems(job)),
          originatingWarehouse(job),
          (job.items || []).map((item) => `${item.materialName} (${item.quantity} ${item.unit})`).join('; '),
        ]),
      ));
    } catch (error: any) {
      Alert.alert('Download failed', error?.message || 'Could not download shipment history.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primaryText} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredJobs.length ? styles.list : styles.empty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon="time-outline" title="No shipments in this period" subtitle="Try another history filter." />}
        ListHeaderComponent={
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterChip, { backgroundColor: filter === option.id ? colors.primary : colors.surface, borderColor: filter === option.id ? colors.primary : colors.border }]}
                  onPress={() => setFilter(option.id)}
                >
                  <Text style={[styles.filterText, { color: filter === option.id ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredJobs.length ? (
              <TouchableOpacity style={[styles.downloadButton, { backgroundColor: colors.primary }]} onPress={downloadCsv} disabled={downloading}>
                {downloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.downloadText}>{downloading ? 'Preparing CSV...' : 'Download CSV'}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSelectedShipment(item)}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
                <Text style={[styles.reference, { color: colors.textMuted }]}>{poReference(item)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                <Text style={styles.statusBadgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Timestamp</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>{formatEAT(shipmentTimestamp(item)) || 'N/A'}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Operator</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>{shipmentOperator(item)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Items</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>{totalDispatchedItems(item)} dispatched</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Origin</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>{originatingWarehouse(item)}</Text>
              </View>
            </View>
            <View style={styles.tapHint}>
              <Text style={[styles.date, { color: colors.textMuted }]}>Tap to view full delivery details</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
      />
      <Modal visible={Boolean(selectedShipment)} transparent animationType="slide" onRequestClose={() => setSelectedShipment(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobId, { color: colors.text }]}>{selectedShipment?.jobId}</Text>
                <Text style={[styles.reference, { color: colors.textMuted }]}>{selectedShipment ? poReference(selectedShipment) : ''}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedShipment(null)}>
                <Ionicons name="close" size={23} color={colors.text} />
              </TouchableOpacity>
            </View>
            {selectedShipment ? (
              <ScrollView style={styles.detailScroll}>
                <View style={styles.auditGrid}>
                  <Text style={[styles.auditText, { color: colors.text }]}>Job ID: {selectedShipment.jobId}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Timestamp: {formatEAT(shipmentTimestamp(selectedShipment)) || 'N/A'}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Operator: {shipmentOperator(selectedShipment)}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Total dispatched items: {totalDispatchedItems(selectedShipment)}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Originating warehouse: {originatingWarehouse(selectedShipment)}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Location: {shipmentLocation(selectedShipment)}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Company: {shipmentCompany(selectedShipment)}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Received by: {selectedShipment.warehouseAcceptedByName || 'Pending site acceptance'}</Text>
                  <Text style={[styles.auditText, { color: colors.text }]}>Source file: {(selectedShipment as any).goodsDeliveryNoteFileName || 'Manual entry'}</Text>
                </View>
                <View style={[styles.productsBlock, { borderTopColor: colors.border }]}>
                  {(selectedShipment.items || []).map((line: any, index) => (
                    <View key={`${selectedShipment.id}-${index}`} style={[styles.productRow, index ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                      <Text style={[styles.productName, { color: colors.text }]}>{line.description || line.materialName}</Text>
                      <Text style={[styles.productMeta, { color: colors.textMuted }]}>{line.quantity} {line.unit || 'tonnes'} - MRF {line.mrfNo || '-'}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['3xl'] },
  empty: { flexGrow: 1, padding: Spacing.md },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  jobId: { fontSize: 15, fontWeight: '800' },
  reference: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs},
  detailText: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 11, marginTop: Spacing.xs},
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  tableRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  tableCell: { flex: 1 },
  tableLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 3 },
  tableValue: { fontSize: 13, fontWeight: '700' },
  tapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  downloadButton: { minHeight: 42, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.xs},
  downloadText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  filterRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterText: { fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  detailSheet: { maxHeight: '86%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, padding: Spacing.md },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  detailScroll: { marginTop: Spacing.sm },
  auditGrid: { gap: 6, paddingBottom: Spacing.sm },
  auditText: { fontSize: 13, fontWeight: '600' },
  productsBlock: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  productRow: { paddingVertical: 8 },
  productName: { fontSize: 13, fontWeight: '800' },
  productMeta: { fontSize: 12, marginTop: 2 },
});
