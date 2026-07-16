import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { formatEAT, normalizeVendorId } from "../../utils/helpers";
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

export default function FuelScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const vendorId = user?.vendorId;
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  console.log(
    "[FuelScreen] user.role:",
    user?.role,
    "user.vendorId:",
    vendorId,
    "normalized:",
    normalizedUserVendorId,
  );

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Vendors only see their own fuel records — always pass vendorId for server-side filtering
      const params = normalizedUserVendorId
        ? { vendorId: normalizedUserVendorId }
        : undefined;
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
          console.log(
            "[FuelScreen] Vendor role detected but no vendorId. Showing empty to prevent data leakage.",
          );
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
    const range = getTimeFilterRange(timeFilter);

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

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="water" size={18} color="#F59E0B" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalFuel.toFixed(1)} L
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Total Fuel
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="car-outline" size={18} color="#3B82F6" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {uniqueTrucks}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Trucks Served
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="receipt-outline" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {filtered.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Records
          </Text>
        </View>
      </View>

     

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
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
        filtered.map((item) => {
          const authCode = item.authorizationCode || item.authorizationId || "";
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
                      color: "#F59E0B",
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
                        marginTop: 0.1,
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
                  style={[styles.fuelBadge, { backgroundColor: "#F59E0B15" }]}
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
                  marginTop:0.1,
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
              : user?.role === "vendor" && !normalizedUserVendorId
                ? "Your vendor account needs to be re-linked. Please log out and log in again."
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