/**
 * Downloads Screen - Export reports, delivery orders, and receipts as PDF
 *
 * Uses expo-print for PDF generation (same pattern as Simrion_flo).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { fetchDeliveryOrders, fetchWeighments } from '../../services/api';
import * as Print from 'expo-print';
import { formatEAT } from '../../utils/helpers';

interface DownloadOption {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    id: 'delivery_orders',
    title: 'Delivery Orders',
    description: 'Export delivery orders as PDF report',
    icon: 'document-text-outline',
    color: '#3B82F6',
  },
  {
    id: 'weigh_records',
    title: 'Weigh Records',
    description: 'Export weighbridge records as PDF',
    icon: 'scale-outline',
    color: '#10B981',
  },
  {
    id: 'site_summary',
    title: 'Site Summary',
    description: 'Export site delivery summary report',
    icon: 'location-outline',
    color: '#F59E0B',
  },
];

export default function DownloadsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<string | null>(null);

  const generateDeliveryOrdersPDF = async () => {
    try {
      const orders = await fetchDeliveryOrders();
      if (!orders || orders.length === 0) {
        Alert.alert('No Data', 'No delivery orders found to export.');
        return;
      }

      const rows = orders
        .map(
          (order: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${order.jobId || order.id || '-'}</td>
          <td>${order.vendorName || '-'}</td>
          <td>${order.driverName || '-'}</td>
          <td>${order.plateNumber || '-'}</td>
          <td>${order.materialName || '-'}</td>
          <td>${order.quantityOrdered || 0} ${order.unit || ''}</td>
          <td>${order.quantityDelivered || 0} ${order.unit || ''}</td>
          <td>${order.status || '-'}</td>
          <td>${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
        </tr>`
        )
        .join('');

      const html = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1E293B; }
            h1 { text-align: center; color: #1B2A4A; font-size: 22px; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #64748B; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #1B2A4A; color: white; padding: 8px 6px; text-align: left; }
            td { padding: 6px; border-bottom: 1px solid #E2E8F0; }
            tr:nth-child(even) { background: #F8FAFC; }
          </style>
        </head>
        <body>
          <h1>TruckSphere - Delivery Orders</h1>
          <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Job ID</th><th>Vendor</th><th>Driver</th>
                <th>Plate</th><th>Material</th><th>Qty Ordered</th>
                <th>Delivered</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to generate PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  const generateWeighRecordsPDF = async () => {
    try {
      const weighments = await fetchWeighments();
      if (!weighments || weighments.length === 0) {
        Alert.alert('No Data', 'No weigh records found to export.');
        return;
      }

      const rows = weighments
        .map(
          (w: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${w.jobId || w.deliveryOrderId || '-'}</td>
          <td>${w.type || '-'}</td>
          <td>${w.weight || 0} ${w.unit || 'kg'}</td>
          <td>${w.location || '-'}</td>
          <td>${w.operatorName || '-'}</td>
          <td>${w.timestamp ? new Date(w.timestamp).toLocaleDateString() : '-'}</td>
        </tr>`
        )
        .join('');

      const html = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1E293B; }
            h1 { text-align: center; color: #1B2A4A; font-size: 22px; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #64748B; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #1B2A4A; color: white; padding: 8px 6px; text-align: left; }
            td { padding: 6px; border-bottom: 1px solid #E2E8F0; }
            tr:nth-child(even) { background: #F8FAFC; }
          </style>
        </head>
        <body>
          <h1>TruckSphere - Weigh Records</h1>
          <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Job ID</th><th>Type</th><th>Weight</th>
                <th>Location</th><th>Operator</th><th>Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to generate PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  const generateSiteSummaryPDF = async () => {
    try {
      const orders = await fetchDeliveryOrders();
      if (!orders || orders.length === 0) {
        Alert.alert('No Data', 'No delivery data found for site summary.');
        return;
      }

      // Group by material
      const grouped: Record<string, { total: number; unit: string }> = {};
      orders.forEach((order: any) => {
        const key = order.materialName || 'Unknown';
        if (!grouped[key]) {
          grouped[key] = { total: 0, unit: order.unit || 'units' };
        }
        grouped[key].total += Number(order.quantityDelivered || 0);
      });

      const rows = Object.entries(grouped)
        .map(
          ([material, data], i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${material}</td>
          <td>${data.total} ${data.unit}</td>
        </tr>`
        )
        .join('');

      const html = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1E293B; }
            h1 { text-align: center; color: #1B2A4A; font-size: 22px; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #64748B; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #1B2A4A; color: white; padding: 10px 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
            .total-row { font-weight: 700; background: #F0FDF4; }
          </style>
        </head>
        <body>
          <h1>TruckSphere - Site Delivery Summary</h1>
          <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr><th>#</th><th>Material</th><th>Total Delivered</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to generate PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDownload = async (optionId: string) => {
    setLoading(optionId);
    switch (optionId) {
      case 'delivery_orders':
        await generateDeliveryOrdersPDF();
        break;
      case 'weigh_records':
        await generateWeighRecordsPDF();
        break;
      case 'site_summary':
        await generateSiteSummaryPDF();
        break;
    }
    setLoading(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.backTitle}>Downloads</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Export Reports</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Generate and download PDF reports
          </Text>
        </View>

        {DOWNLOAD_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleDownload(option.id)}
            disabled={!!loading}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: option.color + '15' }]}>
              <Ionicons name={option.icon} size={28} color={option.color} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{option.description}</Text>
            </View>
            {loading === option.id ? (
              <ActivityIndicator size="small" color={option.color} />
            ) : (
              <Ionicons name="download-outline" size={22} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}

        {/* Upload Section */}
        <Card>
          <View style={styles.uploadSection}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Upload Documents</Text>
              <Text style={[styles.uploadDesc, { color: colors.textMuted }]}>
                Upload delivery notes, receipts, and other documents
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Alert.alert(
                  'Upload Document',
                  'Select document type to upload:',
                  [
                    { text: 'Delivery Note', onPress: () => {} },
                    { text: 'Receipt', onPress: () => {} },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  uploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  uploadDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  uploadBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});