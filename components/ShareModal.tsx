import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/theme';
import { ExportEntity, fetchExportData, buildHtmlTable, buildCsvContent, shareCsvAsFile } from '../utils/exportData';

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

  const [columnStep, setColumnStep] = useState<{
    entity: ExportEntity;
    entityLabel: string;
    title: string;
    headers: string[];
    rows: string[][];
    selected: Set<number>;
    loading: boolean;
  } | null>(null);

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

  const handleStartPrint = async (entity: ExportEntity, entityLabel: string) => {
    setColumnStep({
      entity,
      entityLabel,
      title: '',
      headers: [],
      rows: [],
      selected: new Set(),
      loading: true,
    });
    try {
      const data = await fetchExportData(entity);
      setColumnStep((prev) =>
        prev
          ? {
              ...prev,
              title: data.title,
              headers: data.headers,
              rows: data.rows,
              selected: new Set(data.headers.map((_, i) => i)),
              loading: false,
            }
          : null,
      );
    } catch (e) {
      setColumnStep(null);
    }
  };

  const toggleColumn = (idx: number) => {
    if (!columnStep) return;
    const next = new Set(columnStep.selected);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setColumnStep({ ...columnStep, selected: next });
  };

  const handlePrint = async () => {
    if (!columnStep || columnStep.selected.size === 0) return;
    setExporting(columnStep.entity);

    const selectedIndices = Array.from(columnStep.selected).sort((a, b) => a - b);
    const filteredHeaders = selectedIndices.map((i) => columnStep.headers[i]);
    const filteredRows = columnStep.rows.map((row) =>
      selectedIndices.map((i) => row[i] ?? ''),
    );

    const html = buildHtmlTable(filteredHeaders, filteredRows, columnStep.title);

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html, width: 595, height: 842 });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      console.error('Print error:', e);
    } finally {
      setExporting(null);
      setColumnStep(null);
      onClose();
    }
  };

  const handleClose = () => {
    setColumnStep(null);
    onClose();
  };

  const handleBackFromColumns = () => {
    setColumnStep(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {columnStep ? (
            <>
              {/* Column Selection View */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleBackFromColumns} style={styles.closeBtn}>
                  <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Print — {columnStep.entityLabel}</Text>
                <View style={styles.closeBtn} />
              </View>

              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {columnStep.loading
                  ? 'Loading data...'
                  : `Choose which columns to print. ${columnStep.selected.size} of ${columnStep.headers.length} selected.`}
              </Text>

              {columnStep.loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <ScrollView style={styles.columnList} showsVerticalScrollIndicator={false}>
                  {columnStep.headers.map((header, idx) => {
                    const isSelected = columnStep.selected.has(idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.columnRow,
                          { borderColor: colors.border },
                          isSelected && { backgroundColor: '#1B2A4A0A' },
                        ]}
                        onPress={() => toggleColumn(idx)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? colors.primary : colors.textTertiary}
                        />
                        <Text
                          style={[
                            styles.columnLabel,
                            { color: isSelected ? colors.text : colors.textMuted },
                          ]}
                        >
                          {header}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  {
                    backgroundColor:
                      columnStep.loading || columnStep.selected.size === 0 ? '#CBD5E1' : '#DC2626',
                  },
                ]}
                onPress={handlePrint}
                disabled={columnStep.loading || columnStep.selected.size === 0 || exporting !== null}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="print-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.generateBtnText}>Print</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Main Selection List */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Export Data</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Download as CSV or select columns to print as PDF.
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
                        <TouchableOpacity
                          style={[styles.formatBtn, { backgroundColor: '#DC2626' }]}
                          onPress={() => handleStartPrint(entity.key, entity.label)}
                          disabled={exporting !== null}
                        >
                          <>
                            <Ionicons name="print-outline" size={16} color="#FFF" />
                            <Text style={styles.formatBtnText}>Print</Text>
                          </>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
  },
  columnList: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
  columnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});