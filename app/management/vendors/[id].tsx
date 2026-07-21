/**
 * Vendor Detail Screen - Tabbed view with Overview, Drivers, Vehicles, Documents, Jobs, POs, Performance
 *
 * Features:
 *   - Tab navigation between sections
 *   - Edit vendor details
 *   - View and manage drivers under this vendor
 *   - View and manage vehicles under this vendor
 *   - View documents
 *   - View jobs and purchase orders
 *   - Performance metrics
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Vendor, Driver, Vehicle } from '../../../store/types';
import { formatEAT } from '../../../utils/helpers';
import { UserActionInfo } from '../../../components/UserActionInfo';
import { useAuthStore } from '../../../store/authStore';
import { hasManagementPermission } from '../../../utils/access';

const VENDOR_TABS = [
  { name: 'overview', label: 'Overview', icon: 'information-circle-outline' as const },
  { name: 'drivers', label: 'Drivers', icon: 'people-outline' as const },
  { name: 'vehicles', label: 'Vehicles', icon: 'car-outline' as const },
   
  { name: 'jobs', label: 'Jobs', icon: 'briefcase-outline' as const },
  { name: 'pos', label: 'Purchase Orders', icon: 'document-text-outline' as const },
 ];

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canWriteVendors = hasManagementPermission(user?.role, 'vendors.write');
  const canWriteDrivers = hasManagementPermission(user?.role, 'drivers.write');
  const canWriteTrucks = hasManagementPermission(user?.role, 'trucks.write');
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) loadVendor();
  }, [id]);

  // Auto-reload drivers and vehicles when screen regains focus
  // (e.g. after creating a driver/vehicle and navigating back)
  useFocusEffect(
    useCallback(() => {
      if (id && vendor) {
        Promise.all([
          vendorRepository.getDrivers(vendor.id),
          vendorRepository.getVehicles(vendor.id),
        ]).then(([d, veh]) => {
          setDrivers(d);
          setVehicles(veh);
        }).catch(() => {});
      }
    }, [id, vendor])
  );

  async function loadVendor() {
    setLoading(true);
    try {
      const v = await vendorRepository.getById(id!);
      setVendor(v);
      if (v) {
        const vendorId = v.id || v.vendorId || '';
        const [d, veh, docs] = await Promise.all([
          vendorId ? vendorRepository.getDrivers(vendorId) : Promise.resolve([]),
          vendorId ? vendorRepository.getVehicles(vendorId) : Promise.resolve([]),
          vendorId ? vendorRepository.getDocuments(vendorId) : Promise.resolve([]),
        ]);
        setDrivers(d);
        setVehicles(veh);
        setDocuments(docs);
      }
    } catch {
      Alert.alert('Error', 'Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await vendorRepository.delete(id!);
      Alert.alert('Deleted', 'Vendor has been deleted', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete vendor');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function getStatusBadge(status?: string) {
    const variants: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
      active: { variant: 'success', label: 'Active' },
      inactive: { variant: 'warning', label: 'Inactive' },
      suspended: { variant: 'danger', label: 'Suspended' },
    };
    const config = variants[status || ''] || { variant: 'default' as any, label: status || 'Unknown' };
    return <Badge label={config.label} variant={config.variant} size="md" dot />;
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Vendor not found" />
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
        <Text style={styles.backTitle}>Vendor Details</Text>
      </View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {vendor.companyName?.charAt(0)?.toUpperCase() || 'V'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
              <Text style={[styles.vendorName, { color: colors.text }]}>
                {vendor.companyName || 'Unknown Vendor'}
              </Text>
              <Text style={[styles.vendorId, { color: colors.textMuted }]}>
                {vendor.vendorId || vendor.id} · {vendor.contactPerson || 'No contact'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {getStatusBadge(vendor.status)}
                <Text style={[styles.vendorId, { color: colors.textMuted }]}>
                  {vendor.phone || ''}
                </Text>
              </View>
          </View>
        </View>

        {/* Action Buttons */}
        {(canWriteVendors || canWriteDrivers || canWriteTrucks) && <View style={styles.headerActions}>
          {canWriteVendors && <Button
            title="Edit"
            onPress={() => router.push(`/management/vendors/edit/${vendor.id}` as any)}
            variant="secondary"
            size="sm"
            icon="create-outline"
          />}
          {canWriteDrivers && <Button
            title="Add Driver"
            onPress={() => router.push(`/management/drivers/create?vendorId=${vendor.id}` as any)}
            variant="secondary"
            size="sm"
            icon="person-add-outline"
          />}
          {canWriteTrucks && <Button
            title="Add Vehicle"
            onPress={() => router.push(`/management/vehicles/create?vendorId=${vendor.id}` as any)}
            variant="secondary"
            size="sm"
            icon="car-outline"
          />}
          {canWriteVendors && <Button
            title="Delete"
            onPress={() => setShowDeleteConfirm(true)}
            variant="danger"
            size="sm"
            icon="trash-outline"
          />}
        </View>}
      </View>

      {/* Tabs */}
      <Tabs tabs={VENDOR_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <ScrollView contentContainerStyle={styles.tabContent}>
        {activeTab === 'overview' && (
          <OverviewTab vendor={vendor} colors={colors} />
        )}
        {activeTab === 'drivers' && (
          <DriversTab drivers={drivers} vendorId={vendor.id} colors={colors} canWrite={canWriteDrivers} />
        )}
        {activeTab === 'vehicles' && (
          <VehiclesTab vehicles={vehicles} vendorId={vendor.id} colors={colors} canWrite={canWriteTrucks} />
        )}
        
        {activeTab === 'jobs' && (
          <JobsTab vendorId={vendor.id} colors={colors} />
        )}
        {activeTab === 'pos' && (
          <PurchaseOrdersTab vendorId={vendor.id} colors={colors} />
        )}
       
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Vendor"
        message={`Are you sure you want to delete ${vendor.companyName}? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
    </View>
  );
}

// ─── Overview Tab ───
function OverviewTab({ vendor, colors }: { vendor: Vendor; colors: any }) {
  const fields = [
    { label: 'Vendor ID', value: vendor.vendorId || vendor.id, icon: 'finger-print-outline' },
    { label: 'Company Name', value: vendor.companyName, icon: 'business-outline' },
    { label: 'Contact Person', value: vendor.contactPerson, icon: 'person-outline' },
    { label: 'Phone', value: vendor.phone, icon: 'call-outline' },
    { label: 'Email', value: vendor.email || '-', icon: 'mail-outline' },
    { label: 'Address', value: vendor.address || '-', icon: 'location-outline' },
    { label: 'KRA PIN', value: vendor.kraPin || '-', icon: 'document-text-outline' },
    { label: 'Registration', value: vendor.registrationNumber || '-', icon: 'receipt-outline' },
    { label: 'Created', value: vendor.createdAt ? formatEAT(vendor.createdAt) : '-', icon: 'calendar-outline' },
    { label: 'Updated', value: vendor.updatedAt ? formatEAT(vendor.updatedAt) : '-', icon: 'refresh-outline' },
  ];

  return (
    <>
      <Card>
        {fields.map((field, i) => (
          <View key={i} style={styles.fieldRow}>
            <View style={styles.fieldLabel}>
              <Ionicons name={field.icon as any} size={16} color={colors.textMuted} />
              <Text style={[styles.fieldLabelText, { color: colors.textMuted }]}>{field.label}</Text>
            </View>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{field.value || '-'}</Text>
          </View>
        ))}
      </Card>
      <UserActionInfo record={vendor as any} />
    </>
  );
}

// ─── Drivers Tab ───
function DriversTab({ drivers, vendorId, colors, canWrite }: { drivers: Driver[]; vendorId: string; colors: any; canWrite: boolean }) {
  return (
    <>
      {canWrite && <Button
        title="Add Driver"
        onPress={() => router.push(`/management/drivers/create?vendorId=${vendorId}` as any)}
        icon="person-add-outline"
        size="sm"
        style={{ marginBottom: Spacing.md }}
      />}
      {drivers.length === 0 ? (
        <EmptyState icon="people-outline" title="No drivers" subtitle="Add drivers to this vendor" />
      ) : (
        drivers.map((driver) => (
          <TouchableOpacity
            key={driver.id}
            style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/management/drivers/${driver.id}` as any)}
          >
            <View style={styles.listCardHeader}>
              <View style={[styles.smallAvatar, { backgroundColor: colors.purple + '15' }]}>
                <Text style={[styles.smallAvatarText, { color: colors.purple }]}>
                  {driver.fullName?.charAt(0) || 'D'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listCardTitle, { color: colors.text }]}>{driver.fullName}</Text>
                <Text style={[styles.listCardSub, { color: colors.textMuted }]}>{driver.phone}</Text>
              </View>
              <Badge
                label={driver.status || 'unknown'}
                variant={driver.status === 'active' ? 'success' : driver.status === 'on_trip' ? 'info' : 'default'}
                size="sm"
              />
            </View>
          </TouchableOpacity>
        ))
      )}
    </>
  );
}

// ─── Vehicles Tab ───
function VehiclesTab({ vehicles, vendorId, colors, canWrite }: { vehicles: Vehicle[]; vendorId: string; colors: any; canWrite: boolean }) {
  return (
    <>
      {canWrite && <Button
        title="Add Vehicle"
        onPress={() => router.push(`/management/vehicles/create?vendorId=${vendorId}` as any)}
        icon="car-outline"
        size="sm"
        style={{ marginBottom: Spacing.md }}
      />}
      {vehicles.length === 0 ? (
        <EmptyState icon="car-outline" title="No vehicles" subtitle="Add vehicles to this vendor" />
      ) : (
        vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/management/vehicles/${vehicle.id}` as any)}
          >
            <View style={styles.listCardHeader}>
              <View style={[styles.smallAvatar, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.smallAvatarText, { color: colors.success }]}>
                  {vehicle.registrationNumber?.charAt(0) || 'T'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listCardTitle, { color: colors.text }]}>{vehicle.registrationNumber}</Text>
                <Text style={[styles.listCardSub, { color: colors.textMuted }]}>
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </Text>
              </View>
              <Badge
                label={vehicle.status || 'unknown'}
                variant={vehicle.status === 'active' ? 'success' : vehicle.status === 'on_trip' ? 'info' : 'default'}
                size="sm"
              />
            </View>
          </TouchableOpacity>
        ))
      )}
    </>
  );
}

// ─── Documents Tab ───
function DocumentsTab({ documents, colors }: { documents: any[]; colors: any }) {
  if (documents.length === 0) {
    return <EmptyState icon="document-outline" title="No documents" subtitle="No documents uploaded yet" />;
  }
  return (
    <>
      {documents.map((doc, i) => (
        <Card key={i}>
          <View style={styles.fieldRow}>
            <Ionicons name="document-outline" size={20} color={colors.primary} />
            <Text style={[styles.fieldValue, { color: colors.text, marginLeft: Spacing.sm }]}>
              {doc.name || `Document ${i + 1}`}
            </Text>
          </View>
        </Card>
      ))}
    </>
  );
}

// ─── Jobs Tab ───
function JobsTab({ vendorId, colors }: { vendorId: string; colors: any }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const { jobRepository } = require('../../../services/repositories/JobRepository');
      const all = await jobRepository.getAll();
      setJobs(all.filter((j: any) => j.vendorId === vendorId));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton lines={3} variant="card" />;

  if (jobs.length === 0) {
    return <EmptyState icon="briefcase-outline" title="No jobs" subtitle="Jobs for this vendor will appear here" />;
  }

  return (
    <>
      {jobs.slice(0, 10).map((job: any) => (
        <TouchableOpacity
          key={job.id}
          style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/operations/jobs/${job.id}` as any)}
        >
          <View style={styles.listCardHeader}>
            <View style={[styles.smallAvatar, { backgroundColor: colors.purple + '15' }]}>
              <Text style={[styles.smallAvatarText, { color: colors.purple }]}>J</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listCardTitle, { color: colors.text }]}>{job.jobId || job.id.slice(0, 8)}</Text>
              <Text style={[styles.listCardSub, { color: colors.textMuted }]}>
                {job.materialName} - {job.quantityDispatched || job.quantityOrdered} {job.unit}
              </Text>
            </View>
            <Badge label={job.status?.replace('_', ' ') || 'unknown'} variant="default" size="sm" />
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

// ─── Purchase Orders Tab ───
function PurchaseOrdersTab({ vendorId, colors }: { vendorId: string; colors: any }) {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPOs();
  }, []);

  async function loadPOs() {
    try {
      const { purchaseOrderRepository } = require('../../../services/repositories/PurchaseOrderRepository');
      const all = await purchaseOrderRepository.getAll();
      setPos(all.filter((p: any) => p.vendorId === vendorId));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton lines={3} variant="card" />;

  if (pos.length === 0) {
    return <EmptyState icon="document-text-outline" title="No purchase orders" subtitle="POs for this vendor will appear here" />;
  }

  return (
    <>
      {pos.slice(0, 10).map((po: any) => (
        <TouchableOpacity
          key={po.id}
          style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/management/purchase-orders/${po.id}` as any)}
        >
          <View style={styles.listCardHeader}>
            <View style={[styles.smallAvatar, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.smallAvatarText, { color: colors.danger }]}>PO</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listCardTitle, { color: colors.text }]}>{po.poNumber || po.id.slice(0, 8)}</Text>
              <Text style={[styles.listCardSub, { color: colors.textMuted }]}>
                {po.materialName} - {po.quantity} {po.unit}
              </Text>
            </View>
            <Badge label={po.status || 'unknown'} variant={po.status === 'completed' ? 'success' : po.status === 'cancelled' ? 'danger' : 'default'} size="sm" />
          </View>
        </TouchableOpacity>
      ))}
    </>
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
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  vendorName: {
    fontSize: 20,
    fontWeight: '800',
  },
  vendorId: {
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tabContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  fieldLabelText: {
    fontSize: 13,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  listCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listCardSub: {
    fontSize: 12,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
