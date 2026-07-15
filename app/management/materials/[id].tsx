/**
 * Material Detail Screen - Full material information with dynamic properties
 *
 * Features:
 *   - Material overview with category, unit, status
 *   - Dynamic property display based on category
 *   - Edit material details
 *   - View associated jobs/POs
 *   - Delete material
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
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { Material } from '../../../store/types';
import { formatEAT } from '../../../utils/helpers';

const MATERIAL_TABS = [
  { name: 'details', label: 'Details', icon: 'information-circle-outline' as const },
];

const CATEGORY_COLORS: Record<string, string> = {
  Aggregates: '#F59E0B',
  Steel: '#6B7280',
  Cement: '#3B82F6',
  Liquid: '#06B6D4',
  Blocks: '#8B5CF6',
  Other: '#10B981',
};

export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) loadMaterial();
  }, [id]);

  async function loadMaterial() {
    try {
      const m = await materialRepository.getById(id!);
      setMaterial(m);
    } catch {
      Alert.alert('Error', 'Failed to load material');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    materialRepository.invalidateCache();
    await loadMaterial();
    setRefreshing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await materialRepository.delete(id!);
      Alert.alert('Deleted', 'Material has been deleted', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete material');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  function renderDetails() {
    if (!material) return null;
    const catColor = CATEGORY_COLORS[material.category || 'Other'] || colors.primary;

    return (
      <View>
        <Card>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Name</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{material.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Category</Text>
            <View style={styles.categoryBadge}>
              <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
              <Text style={[styles.detailValue, { color: catColor }]}>{material.category}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Measurement Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{material.measurementType || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Default Unit</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{material.defaultUnit || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
            <Badge
              label={material.status || 'active'}
              variant={material.status === 'active' ? 'success' : 'default'}
              dot
            />
          </View>
          {material.description && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Description</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{material.description}</Text>
            </View>
          )}
          {material.unitPrice !== undefined && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Unit Price</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>KES {material.unitPrice.toLocaleString()}</Text>
            </View>
          )}
        </Card>

        <Card style={{ marginTop: Spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Audit Trail</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created By</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{material.createdBy || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created At</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {material.createdAt ? formatEAT(material.createdAt) : '-'}
            </Text>
          </View>
          {material.updatedAt && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Updated At</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatEAT(material.updatedAt)}
              </Text>
            </View>
          )}
        </Card>
      </View>
    );
  }

  function renderProperties() {
    if (!material) return null;

    if (!material.properties || material.properties.length === 0) {
      return (
        <EmptyState
          icon="settings-outline"
          title="No properties defined"
          subtitle="This material has no custom properties"
        />
      );
    }

    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Material Properties ({material.properties.length})
        </Text>
        {material.properties.map((prop, index) => (
          <View key={index} style={styles.propertyCard}>
            <View style={styles.propertyHeader}>
              <Ionicons
                name={
                  prop.type === 'select' ? 'list-outline' :
                  prop.type === 'number' ? 'calculator-outline' :
                  prop.type === 'boolean' ? 'checkmark-circle-outline' :
                  'text-outline'
                }
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.propertyName, { color: colors.text }]}>
                {prop.label || prop.name}
              </Text>
              {prop.required && (
                <Badge label="Required" variant="warning" size="sm" />
              )}
            </View>
            <Text style={[styles.propertyType, { color: colors.textMuted }]}>
              Type: {prop.type}
              {prop.unit ? ` • Unit: ${prop.unit}` : ''}
            </Text>
            {prop.options && prop.options.length > 0 && (
              <View style={styles.optionsRow}>
                {prop.options.map((opt, i) => (
                  <View key={i} style={[styles.optionChip, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.optionChipText, { color: colors.textMuted }]}>{opt}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </Card>
    );
  }

  function renderUsage() {
    return (
      <EmptyState
        icon="briefcase-outline"
        title="Usage History"
        subtitle="Jobs and purchase orders using this material will appear here"
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

  if (!material) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Material not found" />
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[material.category || 'Other'] || colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Material Details</Text>
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
            <View style={[styles.headerIcon, { backgroundColor: catColor + '15' }]}>
              <Ionicons
                name={
                  material.category === 'Aggregates' ? 'layers-outline' :
                  material.category === 'Steel' ? 'barbell-outline' :
                  material.category === 'Cement' ? 'cube-outline' :
                  material.category === 'Liquid' ? 'water-outline' :
                  material.category === 'Blocks' ? 'grid-outline' :
                  'cube-outline'
                }
                size={28}
                color={catColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{material.name}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {material.category} • {material.defaultUnit || material.measurementType || 'units'}
              </Text>
            </View>
            <Badge
              label={material.status || 'active'}
              variant={material.status === 'active' ? 'success' : 'default'}
              dot
            />
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Button
              title="Edit"
              onPress={() => router.push(`/management/materials/edit/${material.id}` as any)}
              variant="secondary"
              size="sm"
              icon="create-outline"
            />
            <Button
              title="Delete"
              onPress={() => setShowDelete(true)}
              variant="danger"
              size="sm"
              icon="trash-outline"
            />
          </View>
        </View>

        {/* Tabs */}
        <Tabs
          tabs={MATERIAL_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        <View style={{ marginTop: Spacing.md }}>
          {activeTab === 'details' && renderDetails()}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showDelete}
        title="Delete Material"
        message={`Are you sure you want to delete "${material.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        loading={deleting}
      />
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
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  propertyCard: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  propertyType: {
    fontSize: 12,
    marginLeft: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.sm,
    marginLeft: 24,
  },
  optionChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  optionChipText: {
    fontSize: 11,
  },
});
