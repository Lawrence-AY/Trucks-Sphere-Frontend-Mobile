/**
 * Fuel Records Screen - Shows fuel in/out summary with dispensed values
 *
 * Uses EnterpriseUI components matching screens/fuel.tsx style
 * - No stackscreen title (custom header)
 * - No "new fuel" button
 * - Shows dispensed values
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { formatEAT, formatNumber } from "../../utils/helpers";
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

export default function FuelRecordsScreen() {
  const colors = useTheme();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = (await fetchFuelRecords()) || [];
      setRecords(data);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const range = getTimeFilterRange(timeFilter);

    return records.filter((r) => {
      if (
        q &&
        ![r.jobId, r.driverName, r.plateNumber, r.vendorName, r.notes].some(
          (v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
        )
      ) {
        return false;
      }

      if (range) {
        const date = new Date(r.dispensedAt || r.createdAt || r.date || 0);
        if (date < range.start || date >= range.end) {
          return false;
        }
      }

      return true;
    });
  }, [records, search, timeFilter]);

  const fuelIn = useMemo(
    () =>
      filtered
        .filter((r) => r.type === "in" || r.direction === "in")
        .reduce((sum, r) => sum + (r.quantity || r.fuelAmount || 0), 0),
    [filtered],
  );

  const fuelOut = useMemo(
    () =>
      filtered
        .filter((r) => r.type === "out" || r.direction === "out")
        .reduce((sum, r) => sum + (r.quantity || r.fuelAmount || 0), 0),
    [filtered],
  );

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

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="arrow-down-circle" size={18} color="#059669" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatNumber(fuelIn)} L
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Fuel In
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="arrow-up-circle" size={18} color="#DC2626" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatNumber(fuelOut)} L
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Cumulative Fuel Out
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="water" size={18} color="#F59E0B" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatNumber(fuelIn - fuelOut)} L
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Balance
          </Text>
        </View>
      </View>

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      <SectionTitle
        title={`Fuel Records (${filtered.length})`}
      />

      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const type = item.type === "in" || item.direction === "in" ? "in" : "out";
          const qty = item.quantity || item.fuelAmount || 0;
          return (
            <DataCard key={item.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 0.1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: type === "in" ? "#059669" : "#DC2626",
                    }}
                  >
                    {type === "in" ? "Fuel In" : "Fuel Out"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.fuelBadge,
                    {
                      backgroundColor:
                        type === "in" ? "#05966915" : "#DC262615",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: type === "in" ? "#059669" : "#DC2626",
                    }}
                  >
                    {type === "in" ? "+" : "-"}
                    {formatNumber(qty)} L
                  </Text>
                </View>
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || "N/A"} · ${item.plateNumber || "N/A"}`}
              />
              {item.vendorName ? (
                <DetailRow
                  icon="business-outline"
                  value={`Vendor: ${item.vendorName}`}
                />
              ) : null}
              {item.notes ? (
                <DetailRow icon="document-text-outline" value={item.notes} />
              ) : null}
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 0.1,
                }}
              >
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt || item.date)}
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
              : "No fuel has been dispensed yet."
          }
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.xs,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
});