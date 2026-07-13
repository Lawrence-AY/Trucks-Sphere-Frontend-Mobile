import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/theme';
import {
  exportDataAsCSV,
  exportDataAsPDF,
  ExportEntity,
} from '../utils/exportData';

const EXPORT_ENTITIES: { key: ExportEntity; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All Data', icon: 'albums-outline' },
  { key: 'drivers', label: 'All Drivers', icon: 'people-outline' },
  { key: 'trucks', label: 'All Trucks', icon: 'car-outline' },
  { key: 'purchase_orders', label: 'All Purchase Orders', icon: 'document-text-outline' },
  { key: 'deliveries', label: 'All Deliveries', icon: 'cube-outline' },
  { key: 'vendors', label: 'All Vendors', icon: 'business-outline' },
];

const INTERLINKED = ['all'];

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ShareModal({ visible, onClose }: ShareModalProps) {
  const colors = useTheme();
  const [exporting, setExporting] = useState<{ entity: string; format: string } | null>(null);

  const handleExport = async (entity: ExportEntity, format: 'csv' | 'pdf') => {
    setExporting({ entity, format });
    try {
      if (format === 'csv') {
        await exportDataAsCSV(entity);
      } else {
        await exportDataAsPDF(entity);
      }
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Share / Export Data</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Export data as CSV or PDF. Linked exports include vendors, drivers, jobs, trucks, delivered and linked records.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {EXPORT_ENTITIES.map((entity) => {
              const isInterlinked = INTERLINKED.includes(entity.key);
              return (
                <View key={entity.key} style={[styles.entityRow, { borderColor: colors.border }]}>
                  <View style={styles.entityInfo}>
                    <Ionicons name={entity.icon} size={22} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.entityLabel, { color: colors.text }]}>{entity.label}</Text>
                      {isInterlinked && (
                        <Text style={[styles.interlinked, { color: colors.accent }]}>
                          Interlinked — includes vendors, drivers, jobs, trucks, delivered & linked
                        </Text>
                      )}
                      {entity.key === 'purchase_orders' && (
                        <Text style={[styles.interlinked, { color: colors.accent }]}>
                          Includes vendors, drivers, jobs, trucks
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={[styles.formatBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleExport(entity.key, 'csv')}
                      disabled={exporting !== null}
                    >
                      {exporting?.entity === entity.key && exporting?.format === 'csv' ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.formatBtnText}>CSV</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formatBtn, { backgroundColor: '#1B2A4A' }]}
                      onPress={() => handleExport(entity.key, 'pdf')}
                      disabled={exporting !== null}
                    >
                      {exporting?.entity === entity.key && exporting?.format === 'pdf' ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.formatBtnText}>PDF</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  list: {
    marginBottom: Spacing.lg,
  },
  entityRow: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  entityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  entityLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  interlinked: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 3,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  formatBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 64,
    alignItems: 'center',
  },
  formatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    alignSelf: 'center',
    padding: Spacing.md,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});