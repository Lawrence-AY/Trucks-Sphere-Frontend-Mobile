import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';
import { Radius, Spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  BulkImportType,
  CsvAsset,
  ImportPreview,
  commitBulkImport,
  previewBulkImport,
} from '../services/bulkImportService';

type CsvImportPanelProps = {
  type: BulkImportType;
  requiredColumns: string;
  onCompleted?: () => Promise<void> | void;
};

const STATUS_COLORS: Record<string, string> = {
  READY: '#2563EB',
  SKIPPED: '#B45309',
  INVALID: '#DC2626',
  IMPORTED: '#059669',
};

export function CsvImportPanel({ type, requiredColumns, onCompleted }: CsvImportPanelProps) {
  const colors = useTheme();
  const [asset, setAsset] = useState<CsvAsset | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function selectCsv() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const selected = result.assets?.[0];
      if (!selected || !/\.(csv|xlsx)$/i.test(selected.name || '')) {
        Alert.alert('Spreadsheet import', 'Error code: SPREADSHEET_FILE_REQUIRED');
        return;
      }
      const file = { uri: selected.uri, name: selected.name, mimeType: selected.mimeType };
      setAsset(file);
      setPreview(null);
      await loadPreview(file);
    } catch (error: any) {
      Alert.alert('Spreadsheet import', error?.message || 'Error code: CSV_PREVIEW_FAILED');
    }
  }

  async function loadPreview(file = asset) {
    if (!file) return;
    setPreviewing(true);
    try {
      setPreview(await previewBulkImport(type, file));
    } catch (error: any) {
      Alert.alert('Spreadsheet import', error?.message || 'Error code: CSV_PREVIEW_FAILED');
    } finally {
      setPreviewing(false);
    }
  }

  async function commit() {
    if (!asset || !preview?.counts.ready) return;
    setImporting(true);
    try {
      const result = await commitBulkImport(type, asset);
      await onCompleted?.();
      Alert.alert(
        'Spreadsheet import complete',
        `Imported: ${result.counts.imported}\nSkipped: ${result.counts.skipped}\nError codes: ${result.counts.invalid}`,
      );
      setAsset(null);
      setPreview(null);
    } catch (error: any) {
      Alert.alert('Spreadsheet import', error?.message || 'Error code: CSV_IMPORT_FAILED');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card mode="outlined" style={styles.panel} contentStyle={styles.panelContent}>
      <View style={styles.titleRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text variant="titleSmall">Import from CSV or Excel</Text>
          <Text variant="bodySmall" style={{ color: colors.textMuted }}>Preview checks duplicates before any records are added.</Text>
        </View>
      </View>

      <Text variant="labelSmall" style={{ color: colors.textMuted }}>Required columns: {requiredColumns}</Text>

      <Button
        mode="outlined"
        onPress={selectCsv}
        disabled={previewing || importing}
        loading={previewing}
        icon={({ color, size }) => <Ionicons name="document-attach-outline" size={size} color={color} />}
      >
        {asset ? 'Choose another file' : 'Upload CSV or Excel'}
      </Button>

      {asset ? <Text variant="labelMedium" numberOfLines={1}>{asset.name}</Text> : null}

      {preview ? (
        <Card mode="contained" style={styles.preview} contentStyle={styles.previewContent}>
          <View style={styles.summary}>
            <Chip compact style={styles.readyChip}>Ready {preview.counts.ready}</Chip>
            <Chip compact style={styles.skipChip}>Skipped {preview.counts.skipped}</Chip>
            <Chip compact style={styles.invalidChip}>Codes {preview.counts.invalid}</Chip>
          </View>
          <Divider />
          <ScrollView style={styles.rows} nestedScrollEnabled>
            {preview.rows.map((row, index) => (
              <View key={`${row.rowNumber}-${row.label}`}>
                <View style={styles.row}>
                  <Text variant="bodySmall" style={styles.rowLabel} numberOfLines={1}>#{row.rowNumber} {row.label}</Text>
                  <Text variant="labelSmall" style={{ color: STATUS_COLORS[row.status] || colors.textMuted }} numberOfLines={1}>
                    {row.status === 'READY' ? 'READY' : row.code}
                  </Text>
                </View>
                {index < preview.rows.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </ScrollView>
          <Button mode="contained" onPress={commit} disabled={!preview.counts.ready || importing} loading={importing} icon={({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />}>
            Import {preview.counts.ready} ready row{preview.counts.ready === 1 ? '' : 's'}
          </Button>
        </Card>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: Radius.lg, marginBottom: Spacing.lg },
  panelContent: { padding: Spacing.md, gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  preview: { overflow: 'hidden' },
  previewContent: { padding: 0 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, padding: Spacing.sm },
  readyChip: { backgroundColor: '#DBEAFE' },
  skipChip: { backgroundColor: '#FEF3C7' },
  invalidChip: { backgroundColor: '#FEE2E2' },
  rows: { maxHeight: 200 },
  row: { paddingHorizontal: Spacing.sm, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowLabel: { flex: 1 },
});
