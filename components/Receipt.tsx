import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatWeight, formatDateTime, generateReceiptText } from '../utils/helpers';

interface ReceiptProps {
  visible: boolean;
  onClose?: () => void;
  data: {
    stationName: string;
    stationAddress?: string;
    receiptTitle?: string;
    jobId: string;
    plateNumber: string;
    driverName: string;
    driverPhone?: string;
    materialName: string;
    materialUnit?: string;
    weighIn: number;
    weighOut: number;
    netWeight: number;
    poNumber?: string;
    vendorName?: string;
    quarryName?: string;
    siteName?: string;
    timestamp: string;
    operatorName: string;
    location: string;
    receiptType: 'weigh_in' | 'weigh_out' | 'weighment';
    signature?: string;
  };
}

const Receipt: React.FC<ReceiptProps> = ({ visible, onClose, data }) => {
  const colors = useTheme();

  const handleShare = async () => {
    const text = generateReceiptText({
      stationName: data.stationName,
      jobId: data.jobId,
      plateNumber: data.plateNumber,
      driverName: data.driverName,
      materialName: data.materialName,
      weighIn: data.weighIn,
      weighOut: data.weighOut,
      netWeight: data.netWeight,
      timestamp: formatDateTime(data.timestamp),
      operatorName: data.operatorName,
      location: data.location,
    });

    try {
      await Share.share({
        message: text,
        title: `Weighment Receipt - ${data.jobId}`,
      });
    } catch (error) {
      // User cancelled share
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={[styles.container, { backgroundColor: colors.receiptBg }]}>
        {/* Receipt Paper */}
        <ScrollView style={styles.receiptPaper} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, { borderColor: colors.receiptBorder }]}>
            <Text style={[styles.stationIcon]}>⚖️</Text>
            <Text style={[styles.stationName, { color: colors.text }]}>
              {data.stationName}
            </Text>
            {data.stationAddress && (
              <Text style={[styles.stationAddress, { color: colors.textSecondary }]}>
                {data.stationAddress}
              </Text>
            )}
            <Text style={[styles.receiptTitle, { color: colors.textSecondary }]}>
              ─────────────────
            </Text>
            <Text style={[styles.receiptTitle, { color: colors.text }]}>
              {data.receiptTitle || 'WEIGHMENT RECEIPT'}
            </Text>
            <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
              ─────────────────
            </Text>
          </View>

          {/* Job Info */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Job ID:
              </Text>
              <Text style={[styles.value, { color: colors.text, fontWeight: 'bold' }]}>
                {data.jobId}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Vehicle:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {data.plateNumber}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Driver:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {data.driverName}
              </Text>
            </View>
            {data.driverPhone && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Phone:
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {data.driverPhone}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
            ─────────────────
          </Text>

          {/* Material & Weights */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Material:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {data.materialName}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Weigh In:
              </Text>
              <Text style={[styles.monoValue, { color: colors.text }]}>
                {data.weighIn.toFixed(1)} tonnes
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Weigh Out:
              </Text>
              <Text style={[styles.monoValue, { color: colors.text }]}>
                {data.weighOut.toFixed(1)} tonnes
              </Text>
            </View>
            <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
              ─────────────────
            </Text>
            <View style={[styles.netRow, { borderColor: colors.receiptBorder }]}>
              <Text style={[styles.netLabel, { color: colors.text }]}>
                NET WEIGHT
              </Text>
              <Text style={[styles.netValue, { color: colors.primary }]}>
                {data.netWeight.toFixed(1)} tonnes
              </Text>
            </View>
            <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
              ─────────────────
            </Text>
          </View>

          {/* Additional Info */}
          {(data.poNumber || data.vendorName || data.quarryName || data.siteName) && (
            <>
              <View style={styles.section}>
                {data.poNumber && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>PO:</Text>
                    <Text style={[styles.value, { color: colors.text }]}>{data.poNumber}</Text>
                  </View>
                )}
                {data.vendorName && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Vendor:</Text>
                    <Text style={[styles.value, { color: colors.text }]}>{data.vendorName}</Text>
                  </View>
                )}
                {data.quarryName && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Quarry:</Text>
                    <Text style={[styles.value, { color: colors.text }]}>{data.quarryName}</Text>
                  </View>
                )}
                {data.siteName && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Site:</Text>
                    <Text style={[styles.value, { color: colors.text }]}>{data.siteName}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
                ─────────────────
              </Text>
            </>
          )}

          {/* Footer */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Operator:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {data.operatorName}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Location:
              </Text>
              <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
                {data.location}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Time:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatDateTime(data.timestamp)}
              </Text>
            </View>
          </View>

          <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
            ─────────────────
          </Text>

          {/* Barcode area */}
          <View style={styles.barcodeArea}>
            <Text style={[styles.barcode, { color: colors.textMuted }]}>
              || ||| || |||| ||| || |||||
            </Text>
            <Text style={[styles.barcodeText, { color: colors.textMuted }]}>
              [{data.jobId}]
            </Text>
          </View>

          <Text style={[styles.dashLine, { color: colors.textSecondary }]}>
            ─────────────────
          </Text>

          {/* Signature */}
          {data.signature && (
            <View style={styles.signatureArea}>
              <Text style={[styles.signatureLine, { color: colors.textSecondary }]}>
                Signature: ___________________
              </Text>
              <Text style={[styles.signatureName, { color: colors.text }]}>
                {data.signature}
              </Text>
            </View>
          )}

          {/* Thank you */}
          <View style={styles.thankYouArea}>
            <Text style={[styles.thankYou, { color: colors.primary }]}>
              Thank you!
            </Text>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              This is a computer-generated receipt
            </Text>
          </View>

          {/* Perforation */}
          <View style={styles.perforation}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.perfDot,
                  { backgroundColor: colors.textMuted },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actions, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: colors.inputBg, marginLeft: Spacing.sm },
            ]}
            onPress={onClose}
          >
            <Ionicons name="close-outline" size={20} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '88%',
    maxHeight: '85%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  receiptPaper: {
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.md,
  },
  stationIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  stationName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stationAddress: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: Spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dashLine: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: Spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -1,
  },
  section: {
    paddingVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  value: {
    fontSize: 12,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: '55%',
  },
  monoValue: {
    fontSize: 12,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: 'bold',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: Spacing.xs,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  netValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  barcodeArea: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  barcode: {
    fontSize: 18,
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  barcodeText: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signatureArea: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  signatureLine: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signatureName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  thankYouArea: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  thankYou: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerText: {
    fontSize: 9,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  perfDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  actions: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});

export default Receipt;
