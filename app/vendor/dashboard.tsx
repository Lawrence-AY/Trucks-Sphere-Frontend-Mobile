import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useRealtimeCollection } from "../../store/realtimeData";
import { useRealTimeSyncStore } from "../../store/realTimeSyncStore";
import { formatEAT, normalizeVendorId } from "../../utils/helpers";
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from "../../components/EnterpriseUI";

export default function VendorDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || "";
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const { data: allDrivers, loading: driversLoading } = useRealtimeCollection('drivers');
  const { data: allVehicles, loading: vehiclesLoading } = useRealtimeCollection('vehicles');
  const { data: allOrders, loading: ordersLoading } = useRealtimeCollection('purchaseOrders');
  const { data: allDeliveries, loading: deliveriesLoading } = useRealtimeCollection('deliveryOrders');
  const { data: allFuelRecords, loading: fuelLoading } = useRealtimeCollection('fuelRecords');
  const loading = driversLoading || vehiclesLoading || ordersLoading || deliveriesLoading || fuelLoading;

  const drivers = useMemo(() => allDrivers.filter((d: any) =>
    normalizeVendorId(d.vendorId || d.vendor || '') === normalizedUserVendorId
  ), [allDrivers, normalizedUserVendorId]);
  const vehicles = useMemo(() => allVehicles.filter((v: any) =>
    normalizeVendorId(v.vendorId || v.vendor || '') === normalizedUserVendorId
  ), [allVehicles, normalizedUserVendorId]);
  const orders = useMemo(() => allOrders.filter((o: any) =>
    normalizeVendorId(o.vendorId || o.vendor || '') === normalizedUserVendorId
  ), [allOrders, normalizedUserVendorId]);
  const deliveries = useMemo(() => allDeliveries.filter((d: any) =>
    normalizeVendorId(d.vendorId || d.vendor || '') === normalizedUserVendorId
  ), [allDeliveries, normalizedUserVendorId]);
  const fuelRecords = useMemo(() => allFuelRecords.filter((f: any) =>
    normalizeVendorId(f.vendorId || f.vendor || '') === normalizedUserVendorId
  ), [allFuelRecords, normalizedUserVendorId]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refresh('drivers'),
        refresh('vehicles'),
        refresh('purchaseOrders'),
        refresh('deliveryOrders'),
        refresh('fuelRecords'),
      ]);
    } catch (error) {
    } finally {
      setRefreshing(false);
    }
  };

  const activeTrips = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          !["completed", "delivered", "received", "cancelled"].includes(
            d.status,
          ),
      ).length,
    [deliveries],
  );
  const completedTrips = useMemo(
    () =>
      deliveries.filter((d) =>
        ["completed", "delivered", "received"].includes(d.status),
      ).length,
    [deliveries],
  );

  // Keep this derived value for the dashboard totals and recent-fuel widgets.
  const vendorFuelRecords = useMemo(
    () => fuelRecords.filter((f) => {
      const recordVendorId = normalizeVendorId(f.vendorId || f.vendor || "");
      return recordVendorId === normalizedUserVendorId;
    }),
    [fuelRecords, normalizedUserVendorId],
  );

  const totalFuelForVendor = useMemo(
    () => vendorFuelRecords.reduce((s, r) => s + (r.fuelAmount || 0), 0),
    [vendorFuelRecords],
  );

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [deliveries]);

  const getJobFuel = (jobId: string) =>
    vendorFuelRecords
      .filter((f) => f.jobId === jobId)
      .reduce((sum, f) => sum + (f.fuelAmount || 0), 0);

  // Recent fuel records (last 5)
  const recentFuelRecords = useMemo(() => {
    return [...vendorFuelRecords]
      .sort(
        (a, b) =>
          new Date(b.dispensedAt || b.createdAt).getTime() -
          new Date(a.dispensedAt || a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [vendorFuelRecords]);

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
      {/* Summary note: fuel authorization requests appear at the root vendor level (via _layout.tsx) */}

      <View style={styles.metricRow}>
        <MetricTile
          icon="document-text"
          label="Orders"
          value={orders.length}
          tone={colors.primary}
          onPress={() => router.push("/vendor/orders" as any)}
        />
        <MetricTile
          icon="people"
          label="Drivers"
          value={drivers.length}
          tone={colors.accent}
          onPress={() => router.push("/vendor/drivers" as any)}
        />
      </View>
      <View style={styles.metricRow}>
        <MetricTile
          icon="car"
          label="Trucks"
          value={vehicles.length}
          tone={colors.success}
          onPress={() => router.push("/vendor/trucks" as any)}
        />
        <MetricTile
          icon="layers"
          label="Trips"
          value={deliveries.length}
          tone={colors.warning}
          onPress={() => router.push("/vendor/trips" as any)}
        />
      </View>
      <View style={styles.metricRow}>
        <MetricTile
          icon="checkmark-done"
          label="Completed"
          value={completedTrips}
          tone="#10B981"
        />
        <MetricTile
          icon="water"
          label="Fuel Dispensed"
          value={`${totalFuelForVendor.toFixed(1)}L`}
          tone="#F59E0B"
          onPress={() => router.push("/vendor/fuel" as any)}
        />
      </View>

      <SectionTitle
        title="Recent trips"
        action={
          <Text
            style={{ fontSize: 13, fontWeight: "600", color: colors.accent }}
            onPress={() => router.push("/vendor/trips" as any)}
          >
            View all
          </Text>
        }
      />
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => {
          const jobFuel = getJobFuel(item.jobId || "");
          return (
            <DataCard
              key={item.id}
              onPress={() =>
                router.push(
                  `/screens/job-details?id=${item.jobId || item.id}` as any,
                )
              }
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {item.jobId || item.id}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    PO: {item.poNumber || "N/A"}
                  </Text>
                </View>
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || "Unassigned"} · ${item.plateNumber || "No vehicle"}`}
              />
              <DetailRow
                icon="cube-outline"
                value={`${item.materialName || "Material"}   `}
              />
              {jobFuel > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: "#F59E0B10",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#F59E0B",
                    }}
                  >
                    {jobFuel.toFixed(1)} L fuel
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {formatEAT(item.updatedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="cube-outline"
          title="No recent trips"
          subtitle="No deliveries yet for your vendor account."
        />
      )}

      {/* Recent Fuel Records Section */}
      {recentFuelRecords.length > 0 && (
        <>
          <SectionTitle
            title="Recent Fuel Dispensed"
            action={
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.accent,
                }}
                onPress={() => router.push("/vendor/fuel" as any)}
              >
                View all
              </Text>
            }
          />
          {recentFuelRecords.map((item) => {
            const authCode =
              item.authorizationCode || item.authorizationId || "";
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
                          marginTop: 2,
                        }}
                      >
                        <Ionicons
                          name="key-outline"
                          size={11}
                          color="#8B5CF6"
                        />
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
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: "#F59E0B15",
                    }}
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
                {item.totalCost ? (
                  <DetailRow
                    icon="cash-outline"
                    value={`KES ${item.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
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
          })}
        </>
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: "row", gap: Spacing.md },
});
