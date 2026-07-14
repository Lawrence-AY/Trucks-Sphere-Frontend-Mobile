/**
 * Driver Detail Screen - Full driver information with tabs
 *
 * Features:
 *   - Driver overview with photo
 *   - License information
 *   - Current vehicle assignment
 *   - Trip history
 *   - Edit driver details
 */

import React, { useEffect, useState } from 'react';
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
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { Driver } from '../../../store/types';
import { formatEAT } from '../../../utils/helpers';

const DRIVER_TABS = [
  { name: 'details', label: 'Details', icon: 'person-outline' as const },
  { name: 'license', label: 'License', icon: 'card-outline' as const },
  { name: 'trips', label: 'Trips', icon: 'car-outline' as const },
];

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (id) loadDriver();
  }, [id]);

  async function loadDriver() {
    try {
      const d = await driverRepository.getById(id!);
      setDriver(d);
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
    await loadDriver();
    setRefreshing(false);
  }

  function renderDetails() {
    if (!driver) return null;
    return (
      <View>
        <Card>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Full Name</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{driver.fullName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Phone</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{driver.phone}</Text>
          </View>
          {driver.email && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{driver.email}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
            <Badge
              label={driver.status || 'active'}
              variant={driver.status === 'active' ? 'success' : 'default'}
              dot
            />
          </View>
          {driver.emergencyContact && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Emergency Contact</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{driver.emergencyContact}</Text>
            </View>
          )}
        </Card>

        <Card style={{ marginTop: Spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Audit Trail</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created By</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{driver.createdBy || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created At</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {driver.createdAt ? formatEAT(driver.createdAt) : '-'}
            </Text>
          </View>
          {driver.updatedAt && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Updated At</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatEAT(driver.updatedAt)}
              </Text>
            </View>
          )}
        </Card>
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
    return (
      <EmptyState
        icon="car-outline"
        title="Trip History"
        subtitle="Trip history will appear here"
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
              {driver.photoUrl ? (
                <Image source={{ uri: driver.photoUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={32} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{driver.fullName}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {driver.phone}
              </Text>
            </View>
            <Badge
              label={driver.status || 'active'}
              variant={driver.status === 'active' ? 'success' : 'default'}
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
