import { useEffect, useMemo, useState } from "react";
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
import { Radius, Spacing } from "../../constants/theme";
import { fetchDeliveryOrders } from "../../services/api";
import { formatEAT, generateReceiptNoteId } from "../../utils/helpers";
import { buildCsvContent, shareCsvAsFile } from "../../utils/exportData";
import {
  DataCard,
  EmptyState,
 
  PageShell,
  SectionTitle,
 
} from "../../components/EnterpriseUI";

/* ─────────── Filter Types ─────────── */

type FilterPeriod = "today" | "week" | "month";
type DetailView = "overview" | "completed" | "pending";

const FILTER_LABELS: Record<FilterPeriod, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

/* ─────────── Phase 3: History Tab — Logs, Analytics & Reporting ─────────── */

export default function OperatorSiteHistoryScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPeriod>("today");
  const [detailView, setDetailView] = useState<DetailView>("overview");

  // ─── Selected item for detail view ───
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        (d) => !["completed", "delivered", "loaded", "cancelled"].includes(d.status),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [deliveries]);

  const completedRecords = useMemo(() => {
    return deliveries
      .filter((d) => d.status === "completed" || d.status === "delivered")
      .filter((d) => {
        const date = new Date(
          d.receivedAt || d.siteWeighInAt || d.updatedAt || d.createdAt,
        );
        return date >= startDate;
      })
      .map((d) => ({
        ...d,
        receiptNoteId: d.receiptNoteId || generateReceiptNoteId(d.jobId),
      }))
      .sort(
        (a, b) =>
          new Date(
            b.receivedAt || b.siteWeighInAt || b.updatedAt || b.createdAt,
          ).getTime() -
          new Date(
            a.receivedAt || a.siteWeighInAt || a.updatedAt || a.createdAt,
          ).getTime(),
      );
  }, [deliveries, startDate]);

  /* ─── Analytics / Summary Stats ─── */

  const analytics = useMemo(() => {
    const totalCompleted = completedRecords.length;
    const totalSiteNet = completedRecords.reduce(
      (sum, r) => sum + (r.siteNetWeight || r.quantityDelivered || 0),
      0,
    );
    const totalQuarryNet = completedRecords.reduce(
      (sum, r) =>
        sum +
        (r.netWeight ??
          (r.weighInWeight != null && r.weighOutWeight != null
            ? r.weighInWeight - r.weighOutWeight
            : 0)),
      0,
    );
    const totalDifference = completedRecords.reduce(
      (sum, r) => sum + Math.abs(r.siteWeightDifference || 0),
      0,
    );

 
    const discrepancies = completedRecords.filter(
      (r) =>
        r.siteWeightDifference != null &&
        Math.abs(r.siteWeightDifference) > 0.5,
    ).length;

    // Average net per delivery
    const avgNet = totalCompleted > 0 ? totalSiteNet / totalCompleted : 0;

    // Material breakdown
    const materialBreakdown: Record<
      string,
      { count: number; totalNet: number }
    > = {};
    completedRecords.forEach((r) => {
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
    "Qty Ordered (t)",
    "Quarry Net (t)",
    "Site In (t)",
    "Site Out (t)",
    "Site Net (t)",
    "Expected (t)",
    "Difference (t)",
    "Status",
    "Finalized",
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
        String(r.quantityOrdered ?? ""),
        quarryNet != null ? quarryNet.toFixed(1) : "—",
        siteIn != null ? siteIn.toFixed(1) : "—",
        siteOut != null ? siteOut.toFixed(1) : "—",
        siteNet != null ? siteNet.toFixed(1) : "—",
        r.quantityOrdered != null ? r.quantityOrdered.toFixed(1) : "—",
        diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "—",
        r.status || "",
        r.receivedAt || r.updatedAt || r.createdAt || "",
      ];
    });

  const handleDownloadCSV = async () => {
    const rows = buildExportRows(completedRecords);
    const csvContent = buildCsvContent(exportHeaders, rows);
    await shareCsvAsFile(`Site_History_${FILTER_LABELS[filter]}`, csvContent);
  };


  const handleDownloadAllCSV = async () => {
    const rows = buildExportRows(completedRecords);
    const csvContent = buildCsvContent(exportHeaders, rows);
    await shareCsvAsFile(`Site_History_${FILTER_LABELS[filter]}_Complete`, csvContent);
  };

  /* ─── Detail Modal ─── */

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  /* ─── Render: Detail Modal ─── */

  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const item = selectedItem;
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
              contentContainerStyle={{ gap: Spacing.md }}
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
                    {item.materialName || "N/A"}
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
                        <Text style={[styles.dwValue, { color: "#2563EB" }]}>
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
                        <Text style={[styles.dwValue, { color: "#7C3AED" }]}>
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
                        <Text style={[styles.dwValue, { color: "#F59E0B" }]}>
                          {siteIn != null ? `${siteIn.toFixed(1)}T` : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailWeightCell}>
                        <Text
                          style={[styles.dwLabel, { color: colors.textMuted }]}
                        >
                          Out
                        </Text>
                        <Text style={[styles.dwValue, { color: "#8B5CF6" }]}>
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
                            { color: "#10B981", fontSize: 16 },
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
          onRefresh={loadData}
          tintColor={colors.primary}
        />
      }
    >
      {/* ─── Analytics Overview ─── */}
      <View style={styles.analyticsHeader}>
        <Text style={[styles.analyticsTitle, { color: colors.text }]}>
          Analytics & Reporting
        </Text>
        <Text style={[styles.analyticsSub, { color: colors.textMuted }]}>
          {FILTER_LABELS[filter]}
        </Text>
      </View>

     

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(["today", "week", "month"] as FilterPeriod[]).map((period) => {
          const active = filter === period;
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
              onPress={() => setFilter(period)}
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
                color={active ? "#FFFFFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: active ? "#FFFFFF" : colors.textSecondary },
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
          style={[styles.exportBtn, { backgroundColor: "#2563EB" }]}
          onPress={handleDownloadCSV}
        >
          <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
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
                  <Text style={[styles.materialNet, { color: colors.primary }]}>
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
                    {item.materialName || "—"}
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
        title={`Completed — ${FILTER_LABELS[filter]} (${completedRecords.length})`}
      />
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : completedRecords.length ? (
        completedRecords.map((item) => {
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
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tableJobId, { color: colors.text }]}>
                    {item.jobId}
                  </Text>
                  <Text style={[styles.tablePo, { color: colors.textMuted }]}>
                    {item.poNumber || "—"}
                  </Text>
                </View>
                {/* RN Badge — tappable to view receipt note */}
                <TouchableOpacity
                  style={[styles.rnBadge, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}
                  onPress={(e) => { e.stopPropagation(); router.push(`/screens/receipt-note?id=${item.jobId}` as any); }}
                >
                  <Ionicons name="receipt-outline" size={12} color="#10B981" style={{ marginTop: 1 }} />
                  <Text style={[styles.rnBadgeText, { color: '#10B981' }]} numberOfLines={2}>{item.receiptNoteId}</Text>
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
                    {item.materialName || "—"}
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
                    S-In
                  </Text>
                  <Text style={[styles.wValue, { color: "#F59E0B" }]}>
                    {siteIn != null ? `${siteIn.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    S-Out
                  </Text>
                  <Text style={[styles.wValue, { color: "#8B5CF6" }]}>
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
                      { color: colors.success, fontSize: 16 },
                    ]}
                  >
                    {siteNet != null ? `${siteNet.toFixed(1)}T` : "—"}
                  </Text>
                </View>
                <View style={styles.weightCell}>
                  <Text style={[styles.wLabel, { color: colors.textMuted }]}>
                    Q-Net
                  </Text>
                  <Text style={[styles.wValue, { color: "#2563EB" }]}>
                    {quarryNet != null ? `${quarryNet.toFixed(1)}T` : "—"}
                  </Text>
                </View>
              </View>

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
          subtitle={`No finalized deliveries found for ${FILTER_LABELS[filter].toLowerCase()}.`}
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

const styles = StyleSheet.create({
  // Analytics
  analyticsHeader: {
    marginBottom: Spacing.md,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  analyticsSub: {
    fontSize: 13,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  // Filters
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: "700" },
  // Export
  exportRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  exportBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  // Material Breakdown
  materialBreakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
    fontWeight: "700",
    marginBottom: 4,
    maxWidth: "100%",
  },
  materialCount: { fontSize: 11, marginBottom: 2 },
  materialNet: { fontSize: 15, fontWeight: "900" },
  // Table rows
  tableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  tableJobId: { fontSize: 15, fontWeight: "700" },
  tablePo: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  tableRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: 4,
  },
  tableCell: { flex: 1 },
  tableLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  tableValue: { fontSize: 13, fontWeight: "600" },
  tableTimestamp: { fontSize: 12, marginTop: Spacing.sm },
  // Weight Summary
  weightSummary: {
    flexDirection: "row",
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
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
  wValue: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  // RN Badge
  rnBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: '50%',
    minWidth: 0,
  },
  rnBadgeText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  // Detail Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
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
  detailPo: { fontSize: 12, fontWeight: "600", marginTop: 2 },
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
    gap: 6,
  },
  detailSectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
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
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailWeightSubsection: {
    marginTop: 6,
  },
  detailWeightGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  detailWeightCell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  dwLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dwValue: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  detailDiffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
});