import { DateRangeFilter, defaultDateRange, DateRange, isInDateRange } from '../../components/DateRangeFilter';
import { ResponsiveGrid } from '../../components/ResponsiveGrid';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Gap, Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { formatEAT } from "../../utils/helpers";
import { buildCsvContent, shareCsvAsFile } from "../../utils/exportData";
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  FilterRail,
} from "../../components/EnterpriseUI";

// ─── Helpers for cross‑platform printing ──────────────────────────





// ─── Time filters ──────────────────────────────────────────────────

const TIME_FILTERS = [
  { key: "all", label: "All" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function getTimeFilterRange(filter: string): { start: Date; end: Date } | null {
  const now = new Date();
  switch (filter) {
    case "daily": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    default:
      return null;
  }
}

export default function FuelHistoryScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = (await fetchFuelRecords()) || [];
      setRecords(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    autoRefreshRef.current = setInterval(loadData, 24 * 60 * 60 * 1000);
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const range = getTimeFilterRange(timeFilter);

    let result = records.filter((r) => {
      if (
        q &&
        ![r.jobId, r.driverName, r.plateNumber, r.vendorName].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }

      if (!isInDateRange(r.dispensedAt || r.createdAt, dateRange)) return false;
      if (!dateRange && range) {
        const dispensedAt = new Date(r.dispensedAt || r.createdAt);
        if (dispensedAt < range.start || dispensedAt >= range.end) {
          return false;
        }
      }
      return true;
    });
    return result;
  }, [records, search, timeFilter, dateRange]);

  const stats = useMemo(() => {
    const totalLiters = filtered.reduce((s, r) => s + (r.fuelAmount || 0), 0);
    const totalCost = filtered.reduce((s, r) => s + (r.totalCost || 0), 0);
    return { totalLiters, totalCost, count: filtered.length };
  }, [filtered]);

  // ─── Export columns (removed Price/L and Total) ──────────────

  const exportHeaders = [
    "Fuel ID",
    "Driver",
    "Plate",
    "Vendor",
    "Fuel (L)",
    "Auth Code",
    "Timestamp (EAT)",
  ];

  const exportRows = useMemo(() => {
    return filtered.map((item) => [
      item.fuelId || item.id || item.jobId || "",
      item.driverName || "N/A",
      item.plateNumber || "N/A",
      item.vendorName || "N/A",
      item.fuelAmount != null ? item.fuelAmount.toFixed(1) : "0.0",
      item.authorizationCode || item.authorizationId || "",
      formatEAT(item.dispensedAt || item.createdAt || ""),
    ]);
  }, [filtered]);

  // ─── Export states ──────────────────────────────────────────────

  const [exporting, setExporting] = useState<"csv" | null>(null);

  const handleDownloadCSV = async () => {
    setExporting("csv");
    try {
      const csvContent = buildCsvContent(exportHeaders, exportRows);
      await shareCsvAsFile("Fuel_Records", csvContent);
    } catch (error: any) {
      Alert.alert("Download failed", error?.message || "Could not download the fuel CSV report.");
    } finally {
      setExporting(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

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
      <DateRangeFilter value={dateRange || defaultDateRange()} onApply={setDateRange} />
      <FilterRail
        options={TIME_FILTERS}
        value={timeFilter}
        onChange={value => { setTimeFilter(value); setDateRange(null); }}
      />

      <View style={styles.exportRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Download fuel history CSV report"
          disabled={loading || exporting !== null || !filtered.length}
          onPress={() => { void handleDownloadCSV(); }}
          style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: loading || exporting !== null || !filtered.length ? 0.5 : 1 }]}
        >
          <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.exportBtnText}>{exporting === 'csv' ? 'Preparing CSV...' : 'Download CSV report'}</Text>
        </TouchableOpacity>
      </View>
      {!loading && !filtered.length && <Text style={{ color: colors.textMuted }}>No records match the filters. Adjust the filters to download a report.</Text>}

      {filtered.length > 0 && (
        <ResponsiveGrid sideBySide style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="water" size={16} color={colors.warningText} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.totalLiters.toFixed(1)} L
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Fuel
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="receipt-outline" size={16} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Records
            </Text>
          </View>
          {stats.totalCost > 0 && (
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="cash-outline" size={16} color={colors.purpleText} />
              <Text
                style={[styles.statValue, { color: colors.text, fontSize: 13 }]}
              >
                KES {stats.totalCost.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Cost
              </Text>
            </View>
          )}
        </ResponsiveGrid>
      )}


      <SearchField title="Fuel History" icon="time-outline"
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text>
        </DataCard>
      ) : filtered.length ? (
        <View style={styles.historyList}>
          {filtered.map((item) => {
          const isComplete = item.completed === true;
          const authCode = item.authorizationCode || item.authorizationId || "";
          return (
            <DataCard key={item.id} contentStyle={styles.historyCardContent}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center", marginBottom: Spacing.xs,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: isComplete ? colors.success : colors.warningText,
                    }}
                  >
                    {item.fuelId || item.id || item.jobId}
                  </Text>
                  {authCode ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Gap, marginTop: Spacing.xs,
                      }}
                    >
                      <Ionicons name="key-outline" size={11} color={colors.purpleText} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.purpleText,
                          fontFamily: "monospace",
                        }}
                      >
                        Auth PIN: {authCode}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: Gap,
                  }}
                >
                  {item.fuelAmount > 0 ? (
                    <View
                      style={[
                        styles.fuelBadge,
                        { backgroundColor: `${colors.warning}15` },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: colors.warningText,
                        }}
                      >
                        {item.fuelAmount?.toFixed(1)} L
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || "N/A"} · ${item.plateNumber || "N/A"}`}
              />
              <DetailRow
                icon="business-outline"
                value={`Vendor: ${item.vendorName || "N/A"}`}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary, marginTop: Spacing.xs,
                }}
              >
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
          })}
        </View>
      ) : (
        <EmptyState
          icon="water-outline"
          title="No fuel records"
          subtitle={
            timeFilter !== "all"
              ? "No fuel records found for the selected time period."
              : "No fuel records found."
          }
        />
      )}
    </PageShell>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: Gap, marginBottom: Spacing.xs,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: Gap,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  historyCardContent: { gap: Gap},
  historyList: { gap: Gap},
  exportRow: { flexDirection: "row", flexWrap: "wrap", gap: Gap, marginBottom: Spacing.xs},
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: Gap,
  },
  exportBtnText: { color: colors.onPrimary, fontSize: 13, fontWeight: "700" },
});
