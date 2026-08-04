import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useRealtimeCollection } from "../../store/realtimeData";
import { useRealTimeSyncStore } from "../../store/realTimeSyncStore";
import { isActiveJob, normalizeJobStatus } from "../../utils/jobStatus";
import { MANAGEMENT_ROLES, normalizeRole } from "../../utils/access";
import { ManagementLiteDashboard } from "./lite";
import {
  DataCard,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from "../../components/EnterpriseUI";
import { TripListCard } from "../../components/TripListCard";

function isDelayed(item: any) {
  if (!isActiveJob(item.status)) return false;
  const changedAt = new Date(
    item.updatedAt || item.createdAt || Date.now(),
  ).getTime();
  return Date.now() - changedAt > 6 * 60 * 60 * 1000;
}

export default function ManagementDashboardScreen() {
  const user = useAuthStore((state) => state.user);

  if (normalizeRole(user?.role) === MANAGEMENT_ROLES.LITE) {
    return <ManagementLiteDashboard />;
  }

  return <ManagementDashboardContent />;
}

function ManagementDashboardContent() {
  const colors = useTheme();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [refreshing, setRefreshing] = useState(false);

  // Use realtime sync hooks — same pattern proven everywhere else
  const { data: deliveries, loading: deliveriesLoading, error: deliveriesError } = useRealtimeCollection("deliveryOrders");
  const { data: drivers, error: driversError } = useRealtimeCollection("drivers");
  const { data: vehicles, error: vehiclesError } = useRealtimeCollection("vehicles");
  const { data: vendors, error: vendorsError } = useRealtimeCollection("vendors");
  const { data: fuelRecords, error: fuelError } = useRealtimeCollection("fuelRecords");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh('deliveryOrders'),
      refresh('drivers'),
      refresh('vehicles'),
      refresh('vendors'),
      refresh('fuelRecords'),
    ]);
    setRefreshing(false);
  }, [refresh]);

  const stats = useMemo(() => {
    const nonBackorderDeliveries = deliveries.filter((item) => !item.isBackorder);
    const activeTrips = nonBackorderDeliveries.filter((item) => isActiveJob(item.status));
    const deliveredTrips = nonBackorderDeliveries.filter((item) => {
      const status = normalizeJobStatus(item.status);
      return ["SITE_WEIGHED_OUT", "COMPLETED"].includes(status);
    });
    const delayedTrips = nonBackorderDeliveries.filter(isDelayed).length;
    return {
      totalTrips: nonBackorderDeliveries.length,
      activeTrips: activeTrips.length,
      delivered: deliveredTrips.length,
      delayed: delayedTrips,
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
      .filter((item) => Boolean(item.driverId || item.driverName))
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [deliveries]);

  const driverPhotos = useMemo(
    () => new Map(drivers.map((driver: any) => [String(driver.id || '').trim(), driver.photoURL || driver.photoUrl || ''])),
    [drivers],
  );

  const dashboardError = deliveriesError || driversError || vehiclesError || vendorsError || fuelError;

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
            compact
            emphasized
            onPress={() => router.push("/management/trips" as any)}
          />
          <MetricTile
            icon="navigate-circle"
            label="Active trips"
            value={stats.activeTrips}
            tone={colors.accent}
            compact
            emphasized
            onPress={() => router.push("/management/active")}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="checkmark-done-circle"
            label="Delivered"
            value={stats.delivered}
            tone={colors.success}
            compact
            emphasized
            onPress={() => router.push("/management/trips" as any)}
          />
          <MetricTile
            icon="alert-circle"
            label="Delayed"
            value={stats.delayed}
            tone={stats.delayed ? colors.danger : colors.success}
            compact
            emphasized
            onPress={() => router.push("/management/active" as any)}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="briefcase"
            label="Vendors"
            value={stats.totalVendors}
            tone={colors.warning}
            compact
            emphasized
            onPress={() => router.push("/management/vendors" as any)}
          />
          <MetricTile
            icon="people"
            label="Drivers"
            value={stats.totalDrivers}
            tone="#8B5CF6"
            compact
            emphasized
            onPress={() => router.push("/management/drivers" as any)}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="car"
            label="Vehicles"
            value={stats.totalVehicles}
            tone={colors.accent}
            compact
            emphasized
            onPress={() => router.push("/management/trucks")}
          />
          <MetricTile
            icon="water"
            label="Fuel Dispensed"
            value={`${totalFuelDispensed.toFixed(1)}L`}
            tone="#F59E0B"
            compact
            emphasized
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
      {deliveriesLoading && !recentDeliveries.length ? (
        <DataCard>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading operational feed...
          </Text>
        </DataCard>
      ) : dashboardError && !recentDeliveries.length ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Unable to load dashboard data"
          subtitle="Pull down to retry. If this continues, check the API connection."
        />
      ) : recentDeliveries.length ? (
        <View style={styles.recentTripList}>
        {recentDeliveries.map((item) => {
          const driverPhoto = driverPhotos.get(String(item.driverId || '').trim());
          return <TripListCard key={item.id} trip={item} driverPhoto={driverPhoto} onPress={() => router.push(`/operations/jobs/${item.id}` as any)} />;
        })}
        </View>
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
  metricGrid: { gap: 2.5 },
  metricRow: { flexDirection: "row", gap:2.5 },
  recentTripList: { gap: 0.1 },
  link: { fontSize: 13, fontWeight: "900" },
  loadingText: { fontSize: 13, fontWeight: "700" },
});
