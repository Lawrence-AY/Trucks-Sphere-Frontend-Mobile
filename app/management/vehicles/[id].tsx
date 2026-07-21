/**
 * Vehicle Detail Screen - Full vehicle information with tabs
 *
 * Features:
 *   - Vehicle overview with compliance status
 *   - Edit vehicle details
 *   - View assigned driver
 *   - Compliance alerts
 *   - Document management placeholder
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
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { Vehicle } from '../../../store/types';
import { formatEAT } from '../../../utils/helpers';
import { UserActionInfo } from '../../../components/UserActionInfo';

const VEHICLE_TABS = [
  { name: 'details', label: 'Details', icon: 'car-outline' as const },
  { name: 'compliance', label: 'Compliance', icon: 'shield-checkmark-outline' as const },
  { name: 'documents', label: 'Documents', icon: 'folder-outline' as const },
];

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

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
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
            <Badge
              label={vehicle.status || 'active'}
              variant={vehicle.status === 'active' ? 'success' : 'default'}
              dot
            />
          </View>
        </Card>

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

  function renderDocuments() {
    return (
      <EmptyState
        icon="folder-outline"
        title="No Documents"
        subtitle="Vehicle documents will appear here"
      />
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
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Vehicle Details</Text>
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
              <Ionicons name="car" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{vehicle.registrationNumber}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </Text>
            </View>
            <Badge
              label={vehicle.status || 'active'}
              variant={vehicle.status === 'active' ? 'success' : 'default'}
              dot
            />
          </View>

          <View style={styles.actionsRow}>
            <Button
              title="Edit"
              onPress={() => Alert.alert('Coming Soon', 'Edit functionality coming soon')}
              variant="secondary"
              size="sm"
              icon="create-outline"
            />
          </View>
        </View>

        <Tabs
          tabs={VEHICLE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <View style={{ marginTop: Spacing.md }}>
          {activeTab === 'details' && renderDetails()}
          {activeTab === 'compliance' && renderCompliance()}
          {activeTab === 'documents' && renderDocuments()}
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
    fontSize: 14,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
