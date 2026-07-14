/**
 * Create Job Screen - Create a delivery job from a Purchase Order
 *
 * Features:
 *   - Select Purchase Order (auto-fills vendor, material)
 *   - Select Driver (filtered by vendor)
 *   - Select Vehicle (filtered by vendor)
 *   - Set dispatch quantity
 *   - Auto-generate job number
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { jobRepository } from '../../../services/repositories/JobRepository';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { PurchaseOrder, Driver, Vehicle } from '../../../store/types';

export default function CreateJobScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchaseOrderId: '',
    driverId: '',
    vehicleId: '',
    quantity: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived from selected PO
  const selectedPO = pos.find((p) => p.id === form.purchaseOrderId);
  const filteredDrivers = drivers.filter((d) => d.vendorId === selectedPO?.vendorId && d.availability);
  const filteredVehicles = vehicles.filter((v) => v.vendorId === selectedPO?.vendorId && v.status === 'active');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [p, d, v] = await Promise.all([
        purchaseOrderRepository.getAll(),
        driverRepository.getAll(),
        vehicleRepository.getAll(),
      ]);
      setPos(p.filter((po) => po.status === 'approved' || po.status === 'in_progress'));
      setDrivers(d);
      setVehicles(v);
    } catch {
      // Silent
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear dependent fields when PO changes
    if (field === 'purchaseOrderId') {
      setForm((prev) => ({ ...prev, driverId: '', vehicleId: '', quantity: '' }));
    }
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.purchaseOrderId) newErrors.purchaseOrderId = 'Purchase Order is required';
    if (!form.driverId) newErrors.driverId = 'Driver is required';
    if (!form.vehicleId) newErrors.vehicleId = 'Vehicle is required';
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      const driver = drivers.find((d) => d.id === form.driverId);
      const vehicle = vehicles.find((v) => v.id === form.vehicleId);

      await jobRepository.create({
        purchaseOrderId: form.purchaseOrderId,
        poNumber: selectedPO?.poNumber || '',
        vendorId: selectedPO?.vendorId || '',
        vendorName: selectedPO?.vendorName || '',
        driverId: form.driverId,
        driverName: driver?.fullName || '',
        vehicleId: form.vehicleId,
        plateNumber: vehicle?.registrationNumber || '',
        materialId: selectedPO?.materialId || '',
        materialName: selectedPO?.materialName || '',
        quantityOrdered: parseFloat(form.quantity),
        quantityDispatched: parseFloat(form.quantity),
        unit: selectedPO?.unit || '',
        quarryId: selectedPO?.quarryId,
        quarryName: selectedPO?.quarryName,
        siteId: selectedPO?.siteId,
        siteName: selectedPO?.siteName,
        status: 'draft',
        isDelayed: false,
        hasWeightDiscrepancy: false,
      });

      Alert.alert('Success', 'Job created successfully', [
        { text: 'View Jobs', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Create Job</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Job</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Create a delivery job from a Purchase Order
          </Text>
        </View>

        <Card>
          <Select
            label="Purchase Order"
            value={form.purchaseOrderId}
            options={pos.map((p) => ({
              id: p.id,
              name: `${p.poNumber} - ${p.materialName} (${p.vendorName})`,
            }))}
            onSelect={(v) => updateField('purchaseOrderId', v)}
            icon="document-text-outline"
            required
            error={errors.purchaseOrderId}
            placeholder="Select PO..."
          />

          {selectedPO && (
            <View style={[styles.poInfo, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.poInfoText, { color: colors.text }]}>
                Vendor: {selectedPO.vendorName}
              </Text>
              <Text style={[styles.poInfoText, { color: colors.text }]}>
                Material: {selectedPO.materialName}
              </Text>
              <Text style={[styles.poInfoText, { color: colors.text }]}>
                Remaining: {selectedPO.remainingQuantity ?? selectedPO.quantity} {selectedPO.unit}
              </Text>
            </View>
          )}
        </Card>

        <Card style={{ marginTop: Spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Assignment</Text>

          <Select
            label="Driver"
            value={form.driverId}
            options={filteredDrivers.map((d) => ({
              id: d.id,
              name: `${d.fullName} (${d.phone || 'No phone'})`,
            }))}
            onSelect={(v) => updateField('driverId', v)}
            icon="person-outline"
            required
            error={errors.driverId}
            placeholder={selectedPO ? 'Select driver...' : 'Select PO first...'}
          />

          <Select
            label="Vehicle"
            value={form.vehicleId}
            options={filteredVehicles.map((v) => ({
              id: v.id,
              name: `${v.registrationNumber} - ${v.make} ${v.model}`,
            }))}
            onSelect={(v) => updateField('vehicleId', v)}
            icon="car-outline"
            required
            error={errors.vehicleId}
            placeholder={selectedPO ? 'Select vehicle...' : 'Select PO first...'}
          />

          <Input
            label="Dispatch Quantity"
            value={form.quantity}
            onChangeText={(v) => updateField('quantity', v)}
            placeholder="e.g. 30"
            icon="scale-outline"
            keyboardType="numeric"
            required
            error={errors.quantity}
            suffix={selectedPO?.unit || ''}
          />
        </Card>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.actionBtn}
          />
          <Button
            title="Create Job"
            onPress={handleCreate}
            icon="checkmark-circle"
            style={styles.actionBtn}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing.sm,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  poInfo: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
    gap: 4,
  },
  poInfoText: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
});
