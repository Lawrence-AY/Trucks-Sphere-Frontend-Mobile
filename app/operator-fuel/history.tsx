import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { formatEAT } from "../../utils/helpers";
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  FilterRail,
} from "../../components/EnterpriseUI";

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
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  // Auto-refresh every 24 hours
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
      // Search filter
      if (
        q &&
        ![r.jobId, r.driverName, r.plateNumber, r.vendorName].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        )
      ) {
        return false;
      }

      // Time filter
      if (range) {
        const dispensedAt = new Date(r.dispensedAt || r.createdAt);
        if (dispensedAt < range.start || dispensedAt >= range.end) {
          return false;
        }
      }

      return true;
    });

    return result;
  }, [records, search, timeFilter]);

  // Summary stats for the filtered view
  const stats = useMemo(() => {
    const totalLiters = filtered.reduce((s, r) => s + (r.fuelAmount || 0), 0);
    const totalCost = filtered.reduce((s, r) => s + (r.totalCost || 0), 0);
    return { totalLiters, totalCost, count: filtered.length };
  }, [filtered]);

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
      {/* Time filter rail */}
      <FilterRail
        options={TIME_FILTERS}
        value={timeFilter}
        onChange={setTimeFilter}
      />

      {/* Summary stats */}
      {filtered.length > 0 && (
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="water" size={16} color="#F59E0B" />
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
            <Ionicons name="receipt-outline" size={16} color="#10B981" />
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
              <Ionicons name="cash-outline" size={16} color="#8B5CF6" />
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
        </View>
      )}

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      <SectionTitle title={`Fuel Records (${filtered.length})`} />

      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const isComplete = item.completed === true;
          const authCode = item.authorizationCode || item.authorizationId || "";
          return (
            <DataCard key={item.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: isComplete ? "#10B981" : "#F59E0B",
                    }}
                  >
                    {item.fuelId || item.id || item.jobId}
                  </Text>
                  {authCode ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Ionicons name="key-outline" size={11} color="#8B5CF6" />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: "#8B5CF6",
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
                    gap: 4,
                  }}
                >
                  {item.fuelAmount > 0 ? (
                    <View
                      style={[
                        styles.fuelBadge,
                        { backgroundColor: "#F59E0B15" },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: "#F59E0B",
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
              {item.pricePerLiter ? (
                <>
                  <DetailRow
                    icon="cash-outline"
                    value={`${item.pricePerLiter?.toFixed(2)} KES/L`}
                  />
                  {item.totalCost ? (
                    <DetailRow
                      icon="wallet-outline"
                      value={`Total: KES ${item.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                  ) : null}
                </>
              ) : null}
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: Spacing.sm,
                }}
              >
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
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

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
