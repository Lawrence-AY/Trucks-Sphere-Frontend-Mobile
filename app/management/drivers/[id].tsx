/**
 * Driver Detail Screen - Full driver information with tabs
 *
 * Features:
 *   - Driver overview with photo
 *   - License information
 *   - Trip history (powered by realtime sync hooks)
 *   - Edit driver details
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DetailRow } from '../../../components/EnterpriseUI';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { useDeliveryOrders } from '../../../store/realtimeData';
import { useRealTimeSyncStore } from '../../../store/realTimeSyncStore';
import { Driver, Vendor, Job } from '../../../store/types';
import { formatEAT } from '../../../utils/helpers';
import { UserActionInfo } from '../../../components/UserActionInfo';

const DRIVER_TABS = [
  { name: 'details', label: 'Details', icon: 'person-outline' as const },
  { name: 'license', label: 'License', icon: 'card-outline' as const },
  { name: 'trips', label: 'Trips', icon: 'car-outline' as const },
];

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Use realtime sync hook for all delivery orders — reliable, auto-polling
  const allDeliveries = useDeliveryOrders();

  useEffect(() => {
    if (id) loadDriver();
  }, [id]);

  async function loadDriver() {
    try {
      const d = await driverRepository.getById(id!);
      setDriver(d);
      // Load vendor data
      if (d?.vendorId) {
        try {
          const v = await vendorRepository.getById(d.vendorId);
          setVendor(v);
        } catch {
          // Vendor fetch failure is non-critical
        }
      }
      // Refresh delivery orders to ensure trips data is current
      refresh('deliveryOrders');
    } catch {
      Alert.alert('Error', 'Failed to load driver');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    driverRepository.invalidateCache();
    await Promise.all([
      loadDriver(),
      refresh('deliveryOrders'),
    ]);
    setRefreshing(false);
  }

  function handleDelete() {
    Alert.alert(
      'Delete Driver',
      'Are you sure you want to delete this driver? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await driverRepository.delete(id!);
              Alert.alert('Success', 'Driver deleted successfully');
              router.replace('/management/drivers' as any);
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to delete driver');
            }
          },
        },
      ],
    );
  }

  // Filter trips for this driver from the realtime sync data
  const trips = useMemo(() => {
    const driverName = (driver as any)?.name || driver?.fullName || '';
    return allDeliveries.filter((job: any) =>
      job.driverId === id ||
      job.driverName === driverName ||
      (driver as any)?.driverId === job.driverId
    );
  }, [allDeliveries, id, driver]);

  const driverName = (driver as any)?.name || driver?.fullName;

  function renderDetails() {
    if (!driver) return null;
    return (
      <View>
        {/* Driver Info Card */}
        <Card>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Full Name</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{driverName || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Phone</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{driver.phone || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{(driver as any).email || 'N/A'}</Text>
          </View>
          {(driver as any).nationalId ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>National ID</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{(driver as any).nationalId}</Text>
            </View>
          ) : null}
          {driver.emergencyContact && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Emergency Contact</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{driver.emergencyContact}</Text>
            </View>
          )}
        </Card>

        {/* Vendor Info Card */}
        {vendor && (
          <Card style={{ marginTop: Spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vendor Information</Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Company</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{(vendor as any).name || vendor.companyName || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{vendor.email || 'N/A'}</Text>
            </View>
            {vendor.address && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Address</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{vendor.address}</Text>
              </View>
            )}
          </Card>
        )}

        <UserActionInfo record={driver as any} />
      </View>
    );
  }

  function renderLicense() {
    if (!driver) return null;
    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>License Information</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>License Number</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{driver.licenseNumber || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>License Class</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{driver.licenseClass || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Expiry Date</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{driver.licenseExpiry || 'N/A'}</Text>
        </View>
      </Card>
    );
  }

  function renderTrips() {
    if (trips.length === 0) {
      return (
        <EmptyState
          icon="car-outline"
          title="No trips yet"
          subtitle="This driver hasn't completed any trips."
        />
      );
    }
    return (
      <View>
        {trips.map((trip: any) => (
          <Card key={trip.id} style={{ marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                {trip.jobId || trip.id}
              </Text>
              <Badge
                label={trip.status}
                variant={trip.status === 'completed' ? 'success' : trip.status === 'cancelled' ? 'danger' : 'default'}
                dot
              />
            </View>
            <DetailRow
              icon="cube-outline"
              value={`${trip.materialName || 'N/A'} · ${trip.quantityOrdered || 0} ${trip.unit || ''}`}
            />
            <DetailRow
              icon="car-outline"
              value={`${trip.plateNumber || 'N/A'}`}
            />
          
            {trip.netWeight != null && (
              <DetailRow
                icon="scale-outline"
                value={`Net: ${trip.netWeight} ${trip.unit || 'tonnes'}`}
              />
            )}
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
              {trip.createdAt ? formatEAT(trip.createdAt) : ''}
            </Text>
          </Card>
        ))}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Driver not found" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Driver Details</Text>

      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
              {(driver as any).photoURL || (driver as any).photoUrl ? (
                <Image source={{ uri: (driver as any).photoURL || (driver as any).photoUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={32} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{driverName || 'N/A'}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {driver.phone || ''}{vendor ? ` · ${(vendor as any).name || vendor.companyName}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              title="Edit"
              icon="create-outline"
              onPress={() => router.push(`/management/drivers/create?id=${id}` as any)}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <Button
              title="Delete"
              icon="trash-outline"
              onPress={handleDelete}
              variant="danger"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <Tabs
          tabs={DRIVER_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <View style={{ marginTop: Spacing.md }}>
          {activeTab === 'details' && renderDetails()}
          {activeTab === 'license' && renderLicense()}
          {activeTab === 'trips' && renderTrips()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
});
