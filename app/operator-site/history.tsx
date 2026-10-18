import { DateRangeFilter, defaultDateRange, DateRange, isInDateRange } from '../../components/DateRangeFilter';
import { FilterRail } from '../../components/EnterpriseUI';
import { formatPurchaseOrderMaterials, getPurchaseOrderMaterials } from '../../utils/poMaterials';
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { Gap, Radius, Spacing } from "../../constants/theme";
import { useDeliveryOrders } from "@/store/realtimeData";
import { useRealTimeSyncStore } from "@/store/realTimeSyncStore";
import { formatEAT, generateReceiptNoteId } from "../../utils/helpers";
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import { buildCsvContent, shareCsvAsFile } from "../../utils/exportData";
import {
  DataCard,
  EmptyState,
 
  PageShell,
  SectionTitle,
 
} from "../../components/EnterpriseUI";

/* ─────────── Filter Types ─────────── */

type FilterPeriod = "all" | "today" | "week" | "month";
type DetailView = "overview" | "completed" | "pending";

const FILTER_LABELS: Record<FilterPeriod, string> = {
  all: "All time",
  today: "Today",
  week: "This Week",
  month: "This Month",
};

/* ─────────── Phase 3: History Tab — Logs, Analytics & Reporting ─────────── */

const receiver = (item: any): string => item.siteWeighOutByName || item.receivedByName || (typeof item.receivedBy === 'string' ? item.receivedBy : item.receivedBy?.displayName) || item.siteWeighInByName || item.warehouseAcceptedByName || 'Not recorded';
const listenerRecord = (item: any) => Boolean(item.accessBridgeKey || item.accessBridgeSource || item.accessCapture || item.createdBy === 'access_bridge');

export default function OperatorSiteHistoryScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const allDeliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((s) => s.refresh);
  const storeLoading = useRealTimeSyncStore((s) => s.isLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [materialFilter, setMaterialFilter] = useState('');
  const [filter, setFilter] = useState<FilterPeriod>("all");
  const [detailView, setDetailView] = useState<DetailView>("overview");

  // ─── Selected item for detail view ───
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);



  
  function formatEAT(value: any): string {
  if (!value) return '';
  try {
    const d = value instanceof Date
      ? value
      : typeof value?.toDate === 'function'
        ? value.toDate()
        : typeof value === 'object' && typeof value.seconds === 'number'
          ? new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6))
          : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
      hour12: false,
      timeZoneName: 'short',
    });
  } catch { 
    return '';
  }
}
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    setRefreshing(false);
  }, [refresh]);

  // Mark loading as complete once data arrives or store reports finished
  useEffect(() => {
    if (allDeliveries.length > 0) {
      setLoading(false);
    } else if (!storeLoading('deliveryOrders')) {
      setLoading(false);
    }
  }, [allDeliveries, storeLoading]);

  // Safety timeout: stop showing spinner after 10s regardless
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setLoading(false), 10000);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // History is shared across all sites, including listener-created deliveries.
  const deliveries = allDeliveries || [];

  /* ─── Date Range Logic ─── */

  const now = new Date();

  const getStartOfPeriod = (period: FilterPeriod): Date => {
    const d = new Date(now);
    if (period === "today") {
      d.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  const startDate = getStartOfPeriod(filter);

  /* ─── Categorized Data ─── */

  const pendingJobs = useMemo(() => {
    return deliveries
      .filter(
        (d) => !d.warehouseAcceptedAt && isActiveJob(d.status) && normalizeJobStatus(d.status) !== 'DISPATCHED',
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [deliveries]);

  const materialOptions = useMemo(() => Array.from(new Set(deliveries.flatMap(record => getPurchaseOrderMaterials(record).map(line => String(line.materialName || line.productName || line.materialId || '')).filter(Boolean)))).sort().map(name => ({ key: name, label: name })), [deliveries]);
  const matchesMaterial = (record: any) => !materialFilter || getPurchaseOrderMaterials(record).some(line => String(line.materialName || line.productName || line.materialId || '') === materialFilter);
  const rangeLabel = dateRange ? `${dateRange.startDate} to ${dateRange.endDate}` : FILTER_LABELS[filter];

  const completedRecords = useMemo(() => {
    return deliveries
      .filter((d) => Boolean(d.warehouseAcceptedAt) || ['SITE_WEIGHED_OUT', 'COMPLETED'].includes(normalizeJobStatus(d.status)))
      .filter((d) => {
        if (!matchesMaterial(d)) return false;
        if (dateRange) return isInDateRange(d.warehouseAcceptedAt || d.siteWeighOutAt || d.receivedAt || d.siteWeighInAt || d.updatedAt || d.createdAt, dateRange);
        if (filter === "all") return true;
        const date = new Date(
          d.warehouseAcceptedAt || d.siteWeighOutAt || d.receivedAt || d.siteWeighInAt || d.updatedAt || d.createdAt,
        );
        return date >= startDate;
      })
      .map((d) => ({
        ...d,
        receiptNoteId: d.receiptNoteId || generateReceiptNoteId(),
      }))
      .sort(
        (a, b) =>
          new Date(
            b.warehouseAcceptedAt || b.siteWeighOutAt || b.receivedAt || b.siteWeighInAt || b.updatedAt || b.createdAt,
          ).getTime() -
          new Date(
            a.warehouseAcceptedAt || a.siteWeighOutAt || a.receivedAt || a.siteWeighInAt || a.updatedAt || a.createdAt,
          ).getTime(),
      );
  }, [deliveries, startDate, filter, dateRange, materialFilter]);

  /* ─── Analytics / Summary Stats ─── */

  const analytics = useMemo(() => {
    const totalCompleted = completedRecords.length;
    const weighedRecords = completedRecords.filter((r) => !r.isWarehouseMaterial && r.originType !== 'WAREHOUSE');
    const totalSiteNet = weighedRecords.reduce(
      (sum, r) => sum + (r.siteNetWeight || r.quantityDelivered || 0),
      0,
    );
    const totalQuarryNet = weighedRecords.reduce(
      (sum, r) =>
        sum +
        (r.netWeight ??
          (r.weighInWeight != null && r.weighOutWeight != null
            ? r.weighInWeight - r.weighOutWeight
            : 0)),
      0,
    );
    const totalDifference = weighedRecords.reduce(
      (sum, r) => sum + Math.abs(r.siteWeightDifference || 0),
      0,
    );

 
    const discrepancies = weighedRecords.filter(
      (r) =>
        r.siteWeightDifference != null &&
        Math.abs(r.siteWeightDifference) > 0.5,
    ).length;

    // Average net per delivery
    const avgNet = weighedRecords.length > 0 ? totalSiteNet / weighedRecords.length : 0;

    // Material breakdown
    const materialBreakdown: Record<
      string,
      { count: number; totalNet: number }
    > = {};
    weighedRecords.forEach((r) => {
      const mat = r.materialName || "Unknown";
      if (!materialBreakdown[mat]) {
        materialBreakdown[mat] = { count: 0, totalNet: 0 };
      }
      materialBreakdown[mat].count += 1;
      materialBreakdown[mat].totalNet +=
        r.siteNetWeight || r.quantityDelivered || 0;
    });

    return {
      totalCompleted,
      totalSiteNet,
      totalQuarryNet,
      totalDifference,
      discrepancies,
      avgNet,
      materialBreakdown,
    };
  }, [completedRecords]);

  /* ─── Export Logic ─── */

  const exportHeaders = [
    "Receipt Note",
    "Job ID",
    "PO Number",
    "Vendor",
    "Driver",
    "Truck Plate",
    "Material",
    "Lot Number",
    "Quarry Net (t)",
    "Site In (t)",
    "Site Out (t)",
    "Site Net (t)",
    "Difference (t)",
    "Finalized",
    "Warehouse Accepted At",
    "Accepted By",
    "Site",
    "Weighed In By",
    "Site Weigh In At",
    "Weighed Out By",
    "Site Weigh Out At",
    "Received By",
    "Record Source",
  ];

  const buildExportRows = (records: any[]): string[][] =>
    records.map((r) => {
      const quarryNet =
        r.netWeight ??
        (r.weighInWeight != null && r.weighOutWeight != null
          ? r.weighInWeight - r.weighOutWeight
          : null);
      const siteIn = r.siteWeighInWeight ?? null;
      const siteOut = r.siteWeighOutWeight ?? null;
      const siteNet = r.siteNetWeight ?? r.quantityDelivered ?? null;
      const diff =
        r.siteWeightDifference ??
        (siteNet != null && r.quantityOrdered != null
          ? r.quantityOrdered - siteNet
          : null);

      return [
        r.receiptNoteId || "",
        r.jobId || "",
        r.poNumber || "",
        r.vendorName || "",
        r.driverName || "",
        r.plateNumber || "",
        r.materialName || "",
        r.storageLot || r.lotNumber || r.destinationLot || "-",
        quarryNet != null ? quarryNet.toFixed(1) : "—",
        siteIn != null ? siteIn.toFixed(1) : "—",
        siteOut != null ? siteOut.toFixed(1) : "—",
        siteNet != null ? siteNet.toFixed(1) : "—",
        diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "—",
        formatEAT(r.warehouseAcceptedAt || r.receivedAt || r.updatedAt || r.createdAt || ""),
        formatEAT(r.warehouseAcceptedAt),
        r.warehouseAcceptedByName || r.warehouseAcceptedByUid || "",
        r.siteName || r.receivedLocation || r.siteId || "",
        r.siteWeighInByName || "Not recorded",
        formatEAT(r.siteWeighInAt),
        r.siteWeighOutByName || "Not recorded",
        formatEAT(r.siteWeighOutAt),
        receiver(r),
        listenerRecord(r) ? "Weighbridge listener" : "App / other",
      ];
    });

  const handleDownloadCSV = async () => {
    const rows = buildExportRows(completedRecords);
    const csvContent = buildCsvContent(exportHeaders, rows);
    await shareCsvAsFile(`Site_History_${rangeLabel}`, csvContent);
  };


  const handleDownloadAllCSV = async () => {
    const rows = buildExportRows(completedRecords);
    const csvContent = buildCsvContent(exportHeaders, rows);
    await shareCsvAsFile(`Site_History_${rangeLabel}_Complete`, csvContent);
  };

  /* ─── Detail Modal ─── */

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  /* ─── Render: Detail Modal ─── */


  const getWarehouseItems = (item: any) => item.materials || item.additionalItems || [];

  const renderWarehouseReceiptSummary = (item: any) => {
    const warehouseItems = getWarehouseItems(item);
    const totalItems = Number.isFinite(Number(item.itemCount)) && Number(item.itemCount) > 0
      ? Number(item.itemCount)
      : warehouseItems.length;

    return (
      <View style={{ gap: Gap}}>
        <Text style={[styles.tableJobId, { color: colors.text }]}>{item.jobId}</Text>
        {item.receiptNoteId ? <Text style={{ color: colors.text }}>Receipt Note: {item.receiptNoteId}</Text> : null}
        <Text style={{ color: colors.textMuted }}>{item.poNumber || 'No PO'} ? Warehouse</Text>
        <Text style={{ color: colors.text }}>{item.vendorName || ''}</Text>
        <Text style={{ color: colors.text }}>Accepted by: {item.warehouseAcceptedByName || item.warehouseAcceptedByUid || 'Unknown'}</Text>
        <Text style={{ color: colors.textMuted }}>Accepted: {formatEAT(item.warehouseAcceptedAt)}</Text>
        <Text style={{ color: colors.text }}>{normalizeJobStatus(item.status) === 'COMPLETED' ? 'Inspected' : 'Awaiting inspection'}</Text>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Total materials shipped: {totalItems}</Text>
      </View>
    );
  };

  const renderWarehouseReceipt = (item: any) => (
    <View style={{ gap: Gap}}>
      <Text style={[styles.tableJobId, { color: colors.text }]}>{item.jobId}</Text>
      {item.receiptNoteId ? <Text style={{ color: colors.text }}>Receipt Note: {item.receiptNoteId}</Text> : null}
      <Text style={{ color: colors.textMuted }}>{item.poNumber || 'No PO'} ? Warehouse</Text>
      <Text style={{ color: colors.text }}>{item.vendorName || ''}</Text>
      <Text style={{ color: colors.text }}>Accepted by: {item.warehouseAcceptedByName || item.warehouseAcceptedByUid || 'Unknown'}</Text>
      <Text style={{ color: colors.textMuted }}>Accepted: {formatEAT(item.warehouseAcceptedAt)}</Text>
      <Text style={{ color: colors.text }}>{normalizeJobStatus(item.status) === 'COMPLETED' ? 'Inspected' : 'Awaiting inspection'}</Text>
      {getWarehouseItems(item).map((line: any, index: number) => (
        <Text key={line.id || index} style={{ color: colors.text }}>{line.materialName || line.name || line.productName}: {line.quantity ?? ''} {line.unit || ''}</Text>
      ))}
    </View>
  );

  const renderPersonnel = (item: any) => (
    <View style={{ marginTop: Spacing.sm, gap: Gap }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Site Personnel</Text>
      <Text style={{ color: colors.textSecondary }}>Site: {item.siteName || item.receivedLocation || item.siteId || 'Not recorded'}</Text>
      <Text style={{ color: colors.textSecondary }}>Weighed in by: {item.siteWeighInByName || 'Not recorded'}{item.siteWeighInAt ? ' ? ' + formatEAT(item.siteWeighInAt) : ''}</Text>
      <Text style={{ color: colors.textSecondary }}>Weighed out by: {item.siteWeighOutByName || 'Not recorded'}{item.siteWeighOutAt ? ' ? ' + formatEAT(item.siteWeighOutAt) : ''}</Text>
      <Text style={{ color: colors.textSecondary }}>Received by: {receiver(item)}</Text>
      {listenerRecord(item) && <Text style={{ color: colors.textMuted }}>Weighbridge listener</Text>}
    </View>
  );

  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const item = selectedItem;
    if (item.warehouseAcceptedAt) return (
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailSheet, { backgroundColor: colors.surface }]}>
            <ScrollView contentContainerStyle={{ gap: Gap}}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close details" onPress={() => setDetailModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              {renderWarehouseReceipt(item)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
    const siteIn = item.siteWeighInWeight ?? null;
    const siteOut = item.siteWeighOutWeight ?? null;
    const siteNet = item.siteNetWeight ?? item.quantityDelivered ?? null;
    const quarryNet =
      item.netWeight ??
      (item.weighInWeight != null && item.weighOutWeight != null
        ? item.weighInWeight - item.weighOutWeight
        : null);
    const diff = item.siteWeightDifference ?? null;

    return (
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.detailSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Gap}}
            >
              {/* Header */}
              <View style={styles.detailHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailJobId, { color: colors.text }]}>
                    {item.jobId}
                  </Text>
                  <Text style={[styles.detailPo, { color: colors.textMuted }]}>
                    {item.poNumber || "No PO"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.detailCloseBtn,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

             

              {/* Parties */}
              <View
                style={[styles.detailSection, { borderColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.detailSectionTitle,
                    { color: colors.textMuted },
                  ]}
                >
                  PARTIES
                </Text>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Driver
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.driverName || "N/A"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Truck
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.plateNumber || "N/A"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Vendor
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.vendorName || "N/A"}
                  </Text>
                </View>
              </View>

              {/* Route */}
              <View
                style={[styles.detailSection, { borderColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.detailSectionTitle,
                    { color: colors.textMuted },
                  ]}
                >
                  ROUTE
                </Text>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Origin
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.quarryName || "N/A"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Destination
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.siteName || "N/A"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text
                    style={[styles.detailLabel, { color: colors.textMuted }]}
                  >
                    Material
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatPurchaseOrderMaterials(item) || "N/A"}
                  </Text>
                </View>
                 
              </View>

              {/* Weights */}
              <View
                style={[styles.detailSection, { borderColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.detailSectionTitle,
                    { color: colors.textMuted },
                  ]}
                >
                  WEIGHT RECORD
                </Text>

                {/* Quarry weights */}
                {(item.weighInWeight != null ||
                  item.weighOutWeight != null) && (
                  <View style={styles.detailWeightSubsection}>
                    <Text
                      style={[
                        styles.detailSubLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Quarry
                    </Text>
                    <View style={styles.detailWeightGrid}>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          In
                        </Text>
                        <Text style={[styles.dwValue, { color: colors.infoText }]}>
                          {item.weighInWeight != null
                            ? `${item.weighInWeight.toFixed(1)}T`
                            : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          Out
                        </Text>
                        <Text style={[styles.dwValue, { color: colors.purpleText }]}>
                          {item.weighOutWeight != null
                            ? `${item.weighOutWeight.toFixed(1)}T`
                            : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          Net
                        </Text>
                        <Text
                          style={[styles.dwValue, { color: colors.success }]}
                        >
                          {quarryNet != null ? `${quarryNet.toFixed(1)}T` : "—"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Site weights */}
                {(siteIn != null || siteOut != null) && (
                  <View style={styles.detailWeightSubsection}>
                    <Text
                      style={[
                        styles.detailSubLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Site
                    </Text>
                    <View style={styles.detailWeightGrid}>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          In
                        </Text>
                        <Text style={[styles.dwValue, { color: colors.warningText }]}>
                          {siteIn != null ? `${siteIn.toFixed(1)}T` : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          Out
                        </Text>
                        <Text style={[styles.dwValue, { color: colors.purpleText }]}>
                          {siteOut != null ? `${siteOut.toFixed(1)}T` : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          Net
                        </Text>
                        <Text
                          style={[
                            styles.dwValue,
                            { color: colors.success, fontSize: 16 },
                          ]}
                        >
                          {siteNet != null ? `${siteNet.toFixed(1)}T` : "—"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Difference */}
                {diff != null && (
                  <View style={styles.detailDiffRow}>
                    
                    <Text
                      style={[
                        styles.detailValue,
                        {
                          color:
                            Math.abs(diff) > 0.5
                              ? colors.danger
                              : colors.success,
                          fontWeight: "800",
                        },
                      ]}
                    >
                      Δ {diff > 0 ? "+" : ""}
                      {diff.toFixed(2)}T
                    </Text>
                  </View>
                )}
              </View>

              {/* Timestamps */}
              <View
                style={[styles.detailSection, { borderColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.detailSectionTitle,
                    { color: colors.textMuted },
                  ]}
                >
                  TIMELINE
                </Text>
                {item.weighInAt && (
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      Quarry Weigh In
                    </Text>
                    <Text
                      style={[
                        styles.detailValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatEAT(item.weighInAt)}
                    </Text>
                  </View>
                )}
                {item.weighOutAt && (
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      Quarry Weigh Out
                    </Text>
                    <Text
                      style={[
                        styles.detailValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatEAT(item.weighOutAt)}
                    </Text>
                  </View>
                )}
                {renderPersonnel(item)}
                {item.siteWeighInAt && (
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      Site Arrival
                    </Text>
                    <Text
                      style={[
                        styles.detailValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatEAT(item.siteWeighInAt)}
                    </Text>
                  </View>
                )}
                {item.siteWeighOutAt && (
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      Site Finalized
                    </Text>
                    <Text
                      style={[
                        styles.detailValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatEAT(item.siteWeighOutAt)}
                    </Text>
                  </View>
                )}
                {item.receivedAt && (
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      Received
                    </Text>
                    <Text
                      style={[
                        styles.detailValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatEAT(item.receivedAt)}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  /* ─── Main Render ─── */

  return (
    <PageShell
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
     

     

      {/* Filter Pills */}
      <DateRangeFilter value={dateRange || defaultDateRange()} onApply={setDateRange} />
      <Text style={{ color: colors.textMuted }}>Filter by material</Text>
      <FilterRail options={[{ key: '', label: 'All materials' }, ...materialOptions]} value={materialFilter} onChange={setMaterialFilter} />
      <View style={styles.filterRow}>
        {(["all", "today", "week", "month"] as FilterPeriod[]).map((period) => {
          const active = !dateRange && filter === period;
          return (
            <TouchableOpacity
              key={period}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.inputBg,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => { setFilter(period); setDateRange(null); }}
            >
              <Ionicons
                name={
                  period === "today"
                    ? "today-outline"
                    : period === "week"
                      ? "calendar-outline"
                      : "calendar-number-outline"
                }
                size={14}
                color={active ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: active ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {FILTER_LABELS[period]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Export Actions */}
      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.primary }]}
          onPress={handleDownloadCSV}
        >
          <Ionicons name="document-text-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.exportBtnText}>Download CSV</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Material Breakdown ─── */}
      {Object.keys(analytics.materialBreakdown).length > 0 && (
        <>
          <SectionTitle title="Material Breakdown" />
          <View style={styles.materialBreakdownGrid}>
            {Object.entries(analytics.materialBreakdown).map(
              ([material, data]) => (
                <View
                  key={material}
                  style={[
                    styles.materialCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.materialName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {material}
                  </Text>
                  <Text
                    style={[
                      styles.materialCount,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {data.count} deliveries
                  </Text>
                  <Text style={[styles.materialNet, { color: colors.primaryText }]}>
                    {data.totalNet.toFixed(1)}T
                  </Text>
                </View>
              ),
            )}
          </View>
        </>
      )}

      {/* ─── Pending Jobs ─── */}
    
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : pendingJobs.length ? (
        pendingJobs.slice(0, 10).map((item) => {
          const hasSiteWeighIn =
            item.siteWeighInWeight != null || item.status === "weighed_in";
          return (
            <DataCard key={item.id} onPress={() => openDetail(item)}>
              <View style={styles.tableHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tableJobId, { color: colors.text }]}>
                    {item.jobId}
                  </Text>
                  <Text style={[styles.tablePo, { color: colors.textMuted }]}>
                    {item.poNumber || "—"}
                  </Text>
                </View>
                
              </View>
              <View style={styles.tableRow}>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Driver
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {item.driverName || "—"}
                  </Text>
                </View>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Truck
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {item.plateNumber || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.tableRow}>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Material
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {formatPurchaseOrderMaterials(item) || "—"}
                  </Text>
                </View>
               
              </View>
              <View style={styles.tableRow}>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Stage
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {hasSiteWeighIn
                      ? "Awaiting Weigh Out"
                      : "Awaiting Weigh In"}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.tableTimestamp, { color: colors.textTertiary }]}
              >
                Updated: {formatEAT(item.updatedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="clipboard-outline"
          title="No pending jobs"
          subtitle="All jobs have been completed."
        />
      )}

      {/* ─── Completed Records ─── */}
      <SectionTitle
        title={`Completed — ${rangeLabel} (${completedRecords.length})`}
      />
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : completedRecords.length ? (
        completedRecords.map((item) => {
          if (item.warehouseAcceptedAt) return <DataCard key={item.id} onPress={() => openDetail(item)}>{renderWarehouseReceiptSummary(item)}</DataCard>;
          const quarryNet =
            item.netWeight ??
            (item.weighInWeight != null && item.weighOutWeight != null
              ? item.weighInWeight - item.weighOutWeight
              : null);
          const siteNet = item.siteNetWeight ?? item.quantityDelivered ?? null;
          const siteIn = item.siteWeighInWeight ?? null;
          const siteOut = item.siteWeighOutWeight ?? null;

          return (
            <DataCard key={item.id} onPress={() => openDetail(item)}>
              <View style={styles.tableHeaderRow}>
                <View style={{ flex: 0 }}>
                  <Text style={[styles.tableJobId, { color: colors.text }]}>
                    {item.jobId}
                  </Text>
                  <Text style={[styles.tablePo, { color: colors.textMuted }]}>
                    {item.poNumber || "—"}
                  </Text>
                </View>
                {/* RN Badge — tappable to view receipt note */}
                <TouchableOpacity
                  style={[styles.rnBadge, { backgroundColor: `${colors.success}15`, borderColor: `${colors.successBorder}33` }]}
                  onPress={(e) => { e.stopPropagation(); router.push(`/screens/receipt-note?id=${item.jobId}` as any); }}
                >
                  <Ionicons name="receipt-outline" size={12} color={colors.success} style={{ marginTop: Spacing.xs}} />
                  <Text style={[styles.rnBadgeText, { color: colors.success }]} numberOfLines={2}>{item.receiptNoteId}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tableRow}>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Driver
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {item.driverName || "—"}
                  </Text>
                </View>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Truck
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {item.plateNumber || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.tableRow}>
                <View style={styles.tableCell}>
                  <Text
                    style={[styles.tableLabel, { color: colors.textMuted }]}
                  >
                    Material
                  </Text>
                  <Text style={[styles.tableValue, { color: colors.text }]}>
                    {formatPurchaseOrderMaterials(item) || "—"}
                  </Text>
                </View>
               
              </View>

              {/* Weight Summary Row */}
              <View
                style={[
                  styles.weightSummary,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    Q-In
                  </Text>
                  <Text style={[styles.wValue, { color: colors.purpleText }]}>
                    {item.weighInWeight != null ? `${item.weighInWeight.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    Q-Out
                  </Text>
                  <Text style={[styles.wValue, { color: colors.purpleText }]}>
                    {item.weighOutWeight != null ? `${item.weighOutWeight.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    S-In
                  </Text>
                  <Text style={[styles.wValue, { color: colors.warningText }]}>
                    {siteIn != null ? `${siteIn.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    S-Out
                  </Text>
                  <Text style={[styles.wValue, { color: colors.purpleText }]}>
                    {siteOut != null ? `${siteOut.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    S-Net
                  </Text>
                  <Text
                    style={[
                      styles.wValue,
                      { color: colors.success, fontSize: 14 },
                    ]}
                  >
                    {siteNet != null ? `${siteNet.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    Q-Net
                  </Text>
                  <Text style={[styles.wValue, { color: colors.infoText }]}>
                    {quarryNet != null ? `${quarryNet.toFixed(1)}T` : "—"}
                  </Text>
                </View>
              </View>

              {renderPersonnel(item)}
              <Text
                style={[styles.tableTimestamp, { color: colors.textTertiary }]}
              >
                Finalized:{" "}
                {formatEAT(item.receivedAt || item.updatedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title="No completed records"
          subtitle={`No finalized deliveries found for ${rangeLabel.toLowerCase()}.`}
        />
      )}

      {/* Bottom spacing */}
      <View style={{ height: Spacing["4xl"] }} />

      {/* ─── Detail Modal ─── */}
      {renderDetailModal()}
    </PageShell>
  );
}

/* ─── Styles ─── */

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  // Analytics
  analyticsHeader: { marginBottom: Spacing.xs,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  analyticsSub: {
    fontSize: 13, marginTop: Spacing.xs,
  },
  kpiRow: {
    flexDirection: "row",
    gap: Gap, marginBottom: Spacing.xs,
  },
  // Filters
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Gap, marginTop: 0, marginBottom: Spacing.xs,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: "700" },
  // Export
  exportRow: {
    flexDirection: "row",
    gap: Gap, marginBottom:0,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Gap,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  exportBtnText: { color: colors.onPrimary, fontSize: 13, fontWeight: "800" },
  // Material Breakdown
  materialBreakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Gap, marginBottom: Spacing.xs,
  },
  materialCard: {
    flex: 1,
    minWidth: "30%",
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: "center",
  },
  materialName: {
    fontSize: 12,
    fontWeight: "700", marginBottom: Spacing.xs,
    maxWidth: "100%",
  },
  materialCount: { fontSize: 11, marginBottom: Spacing.xs},
  materialNet: { fontSize: 15, fontWeight: "900" },
  // Table rows
  tableHeaderRow: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: Spacing.xs,
  },
  tableJobId: { fontSize: 15, fontWeight: "700" },
  tablePo: { fontSize: 11, fontWeight: "600", marginTop: Spacing.xs},
  tableRow: {
    flexDirection: "row",
    gap: Gap, marginBottom: Spacing.xs,
  },
  tableCell: { flex: 1 },
  tableLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase", marginBottom: Spacing.xs,
  },
  tableValue: { fontSize: 13, fontWeight: "600" },
  tableTimestamp: { fontSize: 12, marginTop: Spacing.xs},
  // Weight Summary
  weightSummary: {
    flexDirection: "row",
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm, marginTop: Spacing.xs,
    gap: Gap,
  },
  weightCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  wLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wValue: { fontSize: 14, fontWeight: "800", marginTop: Spacing.xs},
  // RN Badge
  rnBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Gap,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 1,
    borderWidth: 1,
    maxWidth: '100%',
    minWidth: 0,
  },
  rnBadgeText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  // Detail Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  detailSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: "90%",
  },
  detailHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  detailJobId: { fontSize: 18, fontWeight: "900" },
  detailPo: { fontSize: 12, fontWeight: "600", marginTop: Spacing.xs},
  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSection: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Gap,
  },
  detailSectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase", marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  detailLabel: { fontSize: 12, fontWeight: "600" },
  detailValue: { fontSize: 13, fontWeight: "700" },
  detailValueSmall: { fontSize: 11, fontWeight: "600" },
  detailSubLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: Spacing.xs,
  },
  detailWeightSubsection: { marginTop: Spacing.xs,
  },
  detailWeightGrid: {
    flexDirection: "row",
    gap: Gap,
  },
  detailWeightCell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  dwLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dwValue: { fontSize: 14, fontWeight: "800", marginTop: Spacing.xs},
  detailDiffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center", marginTop: Spacing.xs,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
