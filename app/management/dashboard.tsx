import { useEffect, useMemo, useState } from "react";
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
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
  fetchVendors,
  fetchFuelRecords,
} from "../../services/api";
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

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [
        driverData,
        vehicleData,
        orderData,
        deliveryData,
        vendorData,
        fuelData,
      ] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchVendors(),
        fetchFuelRecords(),
      ]);
      setDrivers(driverData || []);
      setVehicles(vehicleData || []);
      setDeliveries(deliveryData || []);
      setVendors(vendorData || []);
      setFuelRecords(fuelData || []);
    } catch (error) {
      console.error("Management dashboard error:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [deliveries]);

  // Fuel stats
  const totalFuelDispensed = useMemo(
    () => fuelRecords.reduce((s, r) => s + (r.fuelAmount || 0), 0),
    [fuelRecords],
  );

  const recentFuelRecords = useMemo(() => {
    return [...fuelRecords]
      .sort(
        (a, b) =>
          new Date(b.dispensedAt || b.createdAt).getTime() -
          new Date(a.dispensedAt || a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [fuelRecords]);

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
            tone={colors.primary}
            onPress={() => router.push("/management/drivers")}
          />
          <MetricTile
            icon="car"
            label="Vehicles"
            value={stats.totalVehicles}
            tone={colors.accent}
            onPress={() => router.push("/management/trucks")}
          />
        </View>
        <View style={styles.metricRow}>
          <MetricTile
            icon="water"
            label="Fuel Dispensed"
            value={`${totalFuelDispensed.toFixed(1)}L`}
            tone="#F59E0B"
            onPress={() => router.push("/management/fuel" as any)}
          />
          <MetricTile
            icon="receipt"
            label="Fuel Records"
            value={fuelRecords.length}
            tone="#8B5CF6"
            onPress={() => router.push("/screens/fuel" as any)}
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
      {loading ? (
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
            <DetailRow
              icon="navigate-outline"
              value={`${item.quarryName || "Origin"} to ${item.siteName || "Destination"}`}
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

      {/* Recent Fuel Records Section */}
      {recentFuelRecords.length > 0 && (
        <>
          <SectionTitle
            title="Recent Fuel Dispensed"
            action={
              <TouchableOpacity
                onPress={() => router.push("/screens/fuel" as any)}
              >
                <Text style={[styles.link, { color: colors.primary }]}>
                  View all
                </Text>
              </TouchableOpacity>
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
                <DetailRow
                  icon="business-outline"
                  value={`Vendor: ${item.vendorName || "N/A"}`}
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
