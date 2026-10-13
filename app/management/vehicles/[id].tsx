import { BackButton } from '../../../components/ui/BackButton';
import { EditVehicleModal } from '../../../components/EditVehicleModal';
import { useAuthStore } from '@/store/authStore';
import { hasManagementPermission } from '../../../utils/access';
/**
 * Vehicle Detail Screen - Full vehicle information with tabs
 *
 * Features:
 *   - Vehicle overview with compliance status
 *   - View assigned driver
 *   - Compliance alerts
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { Vehicle } from '@/store/types';
import { UserActionInfo } from '../../../components/UserActionInfo';

const VEHICLE_TABS = [
  { name: 'details', label: 'Details', icon: 'car-outline' as const },
  { name: 'compliance', label: 'Compliance', icon: 'shield-checkmark-outline' as const },
];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const insets = useSafeAreaInsets();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const canEdit = hasManagementPermission(useAuthStore(state => state.user?.role), 'trucks.write');

  useEffect(() => {
    if (id) loadVehicle();
  }, [id]);

  async function loadVehicle() {
    try {
      const v = await vehicleRepository.getById(id!);
      setVehicle(v);
    } catch {
      Alert.alert('Error', 'Failed to load vehicle');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    vehicleRepository.invalidateCache();
    await loadVehicle();
    setRefreshing(false);
  }

  function confirmDelete() {
    if (!vehicle) return;
    Alert.alert('Delete vehicle?', `This will permanently remove ${vehicle.registrationNumber || 'this vehicle'}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await vehicleRepository.delete(vehicle.id);
          vehicleRepository.invalidateCache();
          Alert.alert('Deleted', 'Vehicle deleted successfully.');
          router.back();
        } catch (error: any) {
          Alert.alert('Unable to delete vehicle', error?.response?.data?.message || 'Please try again.');
        }
      } },
    ]);
  }

  function renderDetails() {
    if (!vehicle) return null;
    return (
      <View>
        <Card>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Registration</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.registrationNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Make</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.make}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Model</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.model}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Year</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.year}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Capacity</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {vehicle.capacity} {vehicle.capacityUnit || 'tonnes'}
            </Text>
          </View>
           
        </Card>

        <Text style={{ color: colors.text, paddingVertical: 12 }}>Status: {String(vehicle.status || 'active').replace(/_/g, ' ')}</Text>
        <UserActionInfo record={vehicle as any} />
      </View>
    );
  }

  function renderCompliance() {
    if (!vehicle) return null;
    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Compliance Status</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Insurance Expiry</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.insuranceExpiry || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Inspection Expiry</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{vehicle.inspectionExpiry || 'N/A'}</Text>
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Vehicle not found" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} style={styles.backBtn} />
        <Text style={[styles.backTitle, { color: colors.text }]}>Vehicle Details</Text>
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
            <View style={[styles.headerIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="car" size={28} color={colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{vehicle.registrationNumber}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {vehicle.make} {vehicle.model} {vehicle.year}
              </Text>
            </View>
           
          </View>

        </View>

        <View style={styles.tabActionRow}>
          {canEdit ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit Vehicle" onPress={() => setEditing(true)} style={[styles.deleteAction, { borderColor: colors.primary }]}><Ionicons name="create-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Edit Vehicle</Text></TouchableOpacity> : null}
          <View style={{ flex: 1 }}>
            <Tabs tabs={VEHICLE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          </View>
          <TouchableOpacity style={[styles.deleteAction, { borderColor: '#FCA5A5', backgroundColor: colors.dangerBg }]} onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Delete vehicle">
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: Spacing.xs}}>
          {activeTab === 'details' && renderDetails()}
          {activeTab === 'compliance' && renderCompliance()}
        </View>
      </ScrollView>
      {editing ? <EditVehicleModal vehicle={vehicle} onClose={() => setEditing(false)} onSaved={setVehicle} /> : null}
    </View>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Gap,
  },
  deleteAction: {
    minHeight: 42,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
  },
  deleteActionText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12,
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 4,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: { marginBottom: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap, marginBottom: Spacing.xs,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14, marginTop: Spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Gap,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700', marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
