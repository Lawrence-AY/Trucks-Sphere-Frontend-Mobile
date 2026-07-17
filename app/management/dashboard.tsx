import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import {
  useDeliveryOrders,
  useDrivers,
  useFuelRecords,
  usePurchaseOrders,
  useVehicles,
  useVendors,
} from "../../store/realtimeData";
import { useRealTimeSyncStore } from "../../store/realTimeSyncStore";
import { formatEAT } from "../../utils/helpers";
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from "../../components/EnterpriseUI";

function isDelayed(item: any) {
  if (["delivered", "completed", "cancelled"].includes(item.status))
    return false;
  const changedAt = new Date(
    item.updatedAt || item.createdAt || Date.now(),
  ).getTime();
  return Date.now() - changedAt > 6 * 60 * 60 * 1000;
}

export default function ManagementDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [refreshing, setRefreshing] = useState(false);

  // Use realtime sync hooks — same pattern proven everywhere else
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const vendors = useVendors();
  const purchaseOrders = usePurchaseOrders();
  const fuelRecords = useFuelRecords();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh('deliveryOrders'),
      refresh('drivers'),
      refresh('vehicles'),
      refresh('vendors'),
      refresh('purchaseOrders'),
      refresh('fuelRecords'),
    ]);
    setRefreshing(false);
  }, [refresh]);

  const stats = useMemo(() => {
    const activeTrips = deliveries.filter(
      (item) => !["delivered", "completed", "cancelled"].includes(item.status),
    );
    const deliveredTrips = deliveries.filter((item) =>
      ["delivered", "completed"].includes(item.status),
    );
    return {
      totalTrips: deliveries.length,
      activeTrips: activeTrips.length,
      delivered: deliveredTrips.length,
      delayed: deliveries.filter(isDelayed).length,
      totalVendors: vendors.length,
      totalDrivers: drivers.length,
      totalVehicles: vehicles.length,
    };
  }, [deliveries, drivers, vehicles, vendors]);

  const totalFuelDispensed = useMemo(
    () => fuelRecords.reduce((s, r) => s + (r.fuelAmount || 0), 0),
    [fuelRecords],
  );

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [deliveries]);

  const isLoading =
    deliveries.length === 0 &&
    drivers.length === 0 &&
    vehicles.length === 0 &&
    vendors.length === 0;

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
      <View style={styles.metricGrid}>
        <View style={styles.metricRow}>
          <MetricTile
            icon="trail-sign"
            label="Total trips"
            value={stats.totalTrips}
            tone={colors.primary}
            onPress={() => router.push("/management/active")}
          />
          <MetricTile
            icon="navigate-circle"
            label="Active trips"
            value={stats.activeTrips}
            tone={colors.accent}
            onPress={() => router.push("/management/active")}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="checkmark-done-circle"
            label="Delivered"
            value={stats.delivered}
            tone={colors.success}
          />
          <MetricTile
            icon="alert-circle"
            label="Delayed"
            value={stats.delayed}
            tone={stats.delayed ? colors.danger : colors.success}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="briefcase"
            label="Vendors"
            value={stats.totalVendors}
            tone={colors.warning}
          />
          <MetricTile
            icon="people"
            label="Drivers"
            value={stats.totalDrivers}
            tone="#8B5CF6"
            onPress={() => router.push("/management/drivers" as any)}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="car"
            label="Vehicles"
            value={stats.totalVehicles}
            tone={colors.accent}
            onPress={() => router.push("/management/trucks")}
          />
          <MetricTile
            icon="water"
            label="Fuel Dispensed"
            value={`${totalFuelDispensed.toFixed(1)}L`}
            tone="#F59E0B"
            onPress={() => router.push("/management/fuel" as any)}
          />
        </View>
      </View>

      <SectionTitle
        title="Recent trips"
        action={
          <TouchableOpacity onPress={() => router.push("/management/active")}>
            <Text style={[styles.link, { color: colors.primary }]}>
              View all
            </Text>
          </TouchableOpacity>
        }
      />
      {isLoading ? (
        <DataCard>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading operational feed...
          </Text>
        </DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => (
          <DataCard
            key={item.id}
            onPress={() => router.push(`/screens/job-details?id=${item.jobId}`)}
          >
            <View style={styles.deliveryHead}>
              <View>
                <Text style={[styles.deliveryId, { color: colors.text }]}>
                  {item.poNumber || "Unlinked PO"}
                </Text>
                <Text
                  style={[styles.deliveryMeta, { color: colors.textMuted }]}
                >
                  {item.jobId}
                </Text>
              </View>
            </View>
            <DetailRow
              icon="person-outline"
              value={`${item.driverName || "Unassigned"} - ${item.plateNumber || "No vehicle"}`}
            />
            <DetailRow
              icon="cube-outline"
              value={`${item.materialName || "Material"} `}
            />
            
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
              {formatEAT(item.updatedAt || item.createdAt)}
            </Text>
          </DataCard>
        ))
      ) : (
        <EmptyState
          icon="checkmark-circle-outline"
          title="No recent trips"
          subtitle="All visible delivery activity is currently settled."
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricGrid: { gap: Spacing.sm },
  metricRow: { flexDirection: "row", gap: Spacing.xs },
  link: { fontSize: 13, fontWeight: "900" },
  loadingText: { fontSize: 13, fontWeight: "700" },
  deliveryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  deliveryId: { fontSize: 16, fontWeight: "900" },
  deliveryMeta: { fontSize: 12, marginTop: 0.1, fontWeight: "700" },
  timestamp: { fontSize: 11, fontWeight: "700" },
});