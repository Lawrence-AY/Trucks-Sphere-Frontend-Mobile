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
import { ExportEntity, fetchExportData, buildCsvContent, shareCsvAsFile } from '../utils/exportData';

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

  const [exporting, setExporting] = useState<string | null>(null);

  const handleDownloadCSV = async (entity: ExportEntity) => {
    setExporting(entity);
    try {
      const data = await fetchExportData(entity);
      const csv = buildCsvContent(data.headers, data.rows);
      await shareCsvAsFile(data.title, csv);
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setExporting(null);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Export Data</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Download as CSV.
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
                      style={[styles.formatBtn, { backgroundColor: '#2563EB' }]}
                      onPress={() => handleDownloadCSV(entity.key)}
                      disabled={exporting !== null}
                    >
                      {exporting === entity.key ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={16} color="#FFF" />
                          <Text style={styles.formatBtnText}>CSV</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
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
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    padding: Spacing.sm,
    width: 40,
    alignItems: 'center',
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
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 64,
    alignItems: 'center',
    gap: 6,
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