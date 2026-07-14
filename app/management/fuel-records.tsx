/**
 * Fuel Records Screen - Shows fuel in/out summary with full CRUD
 *
 * Features:
 *   - Fuel In: Fuel purchased from external suppliers and stored in tanks
 *   - Fuel Out: Fuel dispensed to trucks or for any other purpose
 *   - Summary cards with totals
 *   - Recent fuel records list
 *   - Create, Edit, Delete fuel records
 *   - Back button
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchFuelRecords, createFuelRecord } from '../../services/api';
import { formatEAT, formatNumber } from '../../utils/helpers';
import api from '../../services/api';

export default function FuelRecordsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<'in' | 'out'>('in');
  const [formQuantity, setFormQuantity] = useState('');
  const [formPlateNumber, setFormPlateNumber] = useState('');
  const [formDriverName, setFormDriverName] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await fetchFuelRecords();
      setRecords(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  // Calculate fuel in/out totals
  const fuelIn = records
    .filter((r) => r.type === 'in' || r.direction === 'in')
    .reduce((sum, r) => sum + (r.quantity || r.amount || 0), 0);

  const fuelOut = records
    .filter((r) => r.type === 'out' || r.direction === 'out')
    .reduce((sum, r) => sum + (r.quantity || r.amount || 0), 0);

  const recentRecords = [...records]
    .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())
    .slice(0, 20);

  function getRecordType(record: any): 'in' | 'out' {
    return (record.type === 'in' || record.direction === 'in') ? 'in' : 'out';
  }

  function resetForm() {
    setFormType('in');
    setFormQuantity('');
    setFormPlateNumber('');
    setFormDriverName('');
    setFormNotes('');
  }

  function openCreateModal() {
    resetForm();
    setShowCreateModal(true);
  }

  function openEditModal(record: any) {
    setEditingRecord(record);
    setFormType(getRecordType(record));
    setFormQuantity(String(record.quantity || record.amount || 0));
    setFormPlateNumber(record.plateNumber || record.vehicleNumber || '');
    setFormDriverName(record.driverName || '');
    setFormNotes(record.notes || '');
    setShowEditModal(true);
  }

  async function handleCreate() {
    if (!formQuantity || parseFloat(formQuantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: formType,
        direction: formType,
        quantity: parseFloat(formQuantity),
        plateNumber: formPlateNumber,
        driverName: formDriverName,
        notes: formNotes,
      };
      await createFuelRecord(payload);
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create fuel record');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingRecord || !formQuantity || parseFloat(formQuantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/fuel/${editingRecord.id}`, {
        type: formType,
        direction: formType,
        quantity: parseFloat(formQuantity),
        plateNumber: formPlateNumber,
        driverName: formDriverName,
        notes: formNotes,
      });
      setShowEditModal(false);
      setEditingRecord(null);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update fuel record');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: any) {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this fuel record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/fuel/${record.id}`);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete fuel record');
            }
          },
        },
      ]
    );
  }

  function renderFormModal(isEdit: boolean) {
    const visible = isEdit ? showEditModal : showCreateModal;
    const onClose = () => {
      if (isEdit) {
        setShowEditModal(false);
        setEditingRecord(null);
      } else {
        setShowCreateModal(false);
      }
      resetForm();
    };
    const onSave = isEdit ? handleUpdate : handleCreate;
    const title = isEdit ? 'Edit Fuel Record' : 'New Fuel Record';

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Type Toggle */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Type</Text>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeBtn, formType === 'in' && { backgroundColor: '#059669', borderColor: '#059669' }]}
                  onPress={() => setFormType('in')}
                >
                  <Ionicons name="arrow-down-circle" size={18} color={formType === 'in' ? '#FFF' : '#059669'} />
                  <Text style={[styles.typeBtnText, { color: formType === 'in' ? '#FFF' : '#059669' }]}>Fuel In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, formType === 'out' && { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}
                  onPress={() => setFormType('out')}
                >
                  <Ionicons name="arrow-up-circle" size={18} color={formType === 'out' ? '#FFF' : '#DC2626'} />
                  <Text style={[styles.typeBtnText, { color: formType === 'out' ? '#FFF' : '#DC2626' }]}>Fuel Out</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Quantity (Liters) *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={formQuantity}
                onChangeText={setFormQuantity}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Plate Number</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={formPlateNumber}
                onChangeText={setFormPlateNumber}
                placeholder="e.g. KCA 123T"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Driver Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={formDriverName}
                onChangeText={setFormDriverName}
                placeholder="Driver name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, minHeight: 60 }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Optional notes"
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{isEdit ? 'Update' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Fuel Records</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}>
          <Ionicons name="add-circle" size={28} color="#1B2A4A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <View style={[styles.summaryIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="arrow-down-circle" size={24} color="#059669" />
            </View>
            <Text style={styles.summaryLabel}>Fuel In</Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              {formatNumber(fuelIn)} L
            </Text>
            <Text style={styles.summarySub}>Purchased & stored</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="arrow-up-circle" size={24} color="#DC2626" />
            </View>
            <Text style={styles.summaryLabel}>Fuel Out</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>
              {formatNumber(fuelOut)} L
            </Text>
            <Text style={styles.summarySub}>Dispensed to trucks</Text>
          </View>
        </View>

        {/* Balance Card */}
        <Card>
          <View style={styles.balanceRow}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Net Balance</Text>
              <Text style={[styles.balanceValue, { color: fuelIn - fuelOut >= 0 ? '#059669' : '#DC2626' }]}>
                {formatNumber(fuelIn - fuelOut)} L
              </Text>
            </View>
            <Ionicons
              name={fuelIn - fuelOut >= 0 ? 'trending-up' : 'trending-down'}
              size={32}
              color={fuelIn - fuelOut >= 0 ? '#059669' : '#DC2626'}
            />
          </View>
        </Card>

        {/* Recent Records */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Records</Text>

        {loading ? (
          <LoadingSkeleton lines={5} variant="card" />
        ) : recentRecords.length === 0 ? (
          <EmptyState
            icon="water-outline"
            title="No fuel records yet"
            subtitle="Fuel records will appear here once fuel operators start dispensing"
          />
        ) : (
          <View style={styles.recordList}>
            {recentRecords.map((record: any, i: number) => {
              const type = getRecordType(record);
              const qty = record.quantity || record.amount || 0;
              return (
                <View
                  key={record.id || i}
                  style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.recordLeft}
                    onPress={() => openEditModal(record)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.recordIcon, { backgroundColor: type === 'in' ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Ionicons
                        name={type === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={20}
                        color={type === 'in' ? '#059669' : '#DC2626'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recordTopRow}>
                        <Text style={[styles.recordType, { color: colors.text }]}>
                          {type === 'in' ? 'Fuel In' : 'Fuel Out'}
                        </Text>
                        <Badge
                          label={type === 'in' ? 'Incoming' : 'Dispensed'}
                          variant={type === 'in' ? 'success' : 'danger'}
                          size="sm"
                        />
                      </View>
                      <Text style={[styles.recordDetail, { color: colors.textMuted }]}>
                        {record.plateNumber || record.vehicleNumber || record.vendorName || 'N/A'}
                        {record.driverName ? ` - ${record.driverName}` : ''}
                      </Text>
                      <Text style={[styles.recordTime, { color: colors.textMuted }]}>
                        {record.createdAt || record.date ? formatEAT(record.createdAt || record.date) : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.recordActions}>
                    <Text style={[styles.recordQty, { color: type === 'in' ? '#059669' : '#DC2626' }]}>
                      {type === 'in' ? '+' : '-'}{formatNumber(qty)}L
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(record)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Modal */}
      {renderFormModal(false)}

      {/* Edit Modal */}
      {renderFormModal(true)}
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
    flex: 1,
  },
  addBtn: {
    padding: 4,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  summarySub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  recordList: {
    gap: Spacing.sm,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recordType: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordDetail: {
    fontSize: 12,
    marginTop: 1,
  },
  recordTime: {
    fontSize: 11,
    marginTop: 1,
  },
  recordQty: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: Spacing.sm,
  },
  recordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: -4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: '#1B2A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
