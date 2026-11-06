import { ResponsiveGrid } from '../../components/ResponsiveGrid';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Gap, Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { useAuthStore } from "@/store/authStore";
import { formatEAT, getEATDateRange, normalizeVendorId } from "../../utils/helpers";
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
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

export default function FuelScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("daily");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const vendorId = user?.vendorId;
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  if (__DEV__) {
    console.log(
      "[FuelScreen] user.role:",
      user?.role,
      "user.vendorId:",
      vendorId,
      "normalized:",
      normalizedUserVendorId,
    );
  }

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Vendors only see their own fuel records — always pass vendorId for server-side filtering
      const params = normalizedUserVendorId
        ? { vendorId: normalizedUserVendorId, limit: 500 }
        : { limit: 500 };
      let data = (await fetchFuelRecords(params)) || [];
      // Double-enforce: client-side filter ensures ONLY this vendor's records are shown
      const isVendor = user?.role === "vendor";
      if (isVendor) {
        if (normalizedUserVendorId) {
          data = data.filter((r: any) => {
            const recordVendorId = normalizeVendorId(r.vendorId || r.vendor);
            return recordVendorId === normalizedUserVendorId;
          });
        } else {
          // Vendor role without vendorId — cannot determine which records belong to them
          if (__DEV__) {
            console.log(
              "[FuelScreen] Vendor role detected but no vendorId. Showing empty to prevent data leakage.",
            );
          }
          data = [];
        }
      }
      setRecords(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [normalizedUserVendorId, user?.role]);

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
    const range = getEATDateRange(timeFilter);

    return records.filter((r) => {
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
  }, [records, search, timeFilter]);

  const totalFuel = useMemo(
    () => filtered.reduce((s, r) => s + (r.fuelAmount || 0), 0),
    [filtered],
  );
  const uniqueTrucks = useMemo(
    () => new Set(filtered.map((r) => r.plateNumber)).size,
    [filtered],
  );
  const totalCost = useMemo(
    () => filtered.reduce((s, r) => s + (r.totalCost || 0), 0),
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

      <View style={styles.metricGrid}>
        <ResponsiveGrid sideBySide maxColumns={3} style={styles.metricRow}>
          <MetricTile icon="water" label="Total Fuel" value={`${totalFuel.toFixed(1)}L`} tone={colors.warning} compact emphasized />
          <MetricTile icon="car" label="Trucks Served" value={uniqueTrucks} tone="#3B82F6" compact emphasized />
          <MetricTile icon="receipt" label="Records" value={filtered.length} tone={colors.success} compact emphasized />
        </ResponsiveGrid>
      </View>

     

      <SearchField title="Fuel Records" icon="water-outline"
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      <View style={{ gap: 6 }}>
      <SectionTitle
        title={
          normalizedUserVendorId
            ? `Fuel Records · ${user?.displayName || normalizedUserVendorId} (${filtered.length})`
            : `All Fuel Records (${filtered.length})`
        }
      />

      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : filtered.length ? (
        <View style={{ gap: 6 }}>{filtered.map((item) => {
          const authCode = item.authorizationCode || item.authorizationId || "";
          return (
            <DataCard key={item.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between", marginBottom: Spacing.xs,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: colors.warning,
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
                      <Ionicons name="key-outline" size={11} color={colors.purple} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.purple,
                          fontFamily: "monospace",
                        }}
                      >
                        Auth PIN: {authCode}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={[styles.fuelBadge, { backgroundColor: "#F59E0B15" }]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: colors.warning,
                    }}
                  >
                    {item.fuelAmount?.toFixed(1)} L
                  </Text>
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
                  color: colors.textTertiary, marginTop: Spacing.xs,
                }}
              >
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })}</View>
      ) : (
        <EmptyState
          icon="water-outline"
          title="No fuel records"
          subtitle={
            timeFilter !== "all"
              ? "No fuel records found for the selected time period."
              : user?.role === "vendor" && !normalizedUserVendorId
                ? "Your vendor account needs to be re-linked. Please log out and log in again."
                : "No fuel has been dispensed yet."
          }
        />
      )}
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricGrid: { gap: Gap },
  metricRow: { gap: Gap },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
 
});
