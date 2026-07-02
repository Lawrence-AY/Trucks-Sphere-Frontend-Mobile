import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, updateDeliveryOrder } from '../../services/api';
import { formatEAT, generateReceiptNoteId } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
 
} from '../../components/EnterpriseUI';

/* ─────────── Configuration ─────────── */


/* ─────────── GRN (Good Receipt Note) Helpers ─────────── */

function escapeCsvField(value: any): string {
  if (value == null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsv(headers: string[], rows: string[][]): string {
  const hdr = headers.map(escapeCsvField).join(',');
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
  return `${hdr}\n${body}`;
}

function buildReceiptHtml(data: {
  jobId: string;
  receiptNoteId: string;
  poNumber: string;
  driverName: string;
  plateNumber: string;
  vendorName: string;
  materialName: string;
  quantityOrdered: number;
  quarryName: string;
  siteName: string;
  weightIn: number;
  weightOut: number;
  netWeight: number;
  timestamp: string;
  operatorName: string;
}): string {
  return `
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E293B; max-width: 600px; margin: auto; }
        .header { text-align: center; border-bottom: 3px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { color: #1B2A4A; font-size: 20px; margin-bottom: 4px; }
        .header .subtitle { color: #64748B; font-size: 13px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
        .row .label { color: #64748B; }
        .row .value { font-weight: 700; color: #1E293B; }
        .highlight-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
        .highlight-box .net { font-size: 32px; font-weight: 900; color: #16A34A; }
        .highlight-box .calc { font-size: 11px; color: #64748B; margin-top: 4px; }
        .discrepancy { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 12px; margin: 16px 0; }
        .discrepancy .disc-title { color: #991B1B; font-weight: 800; font-size: 12px; text-transform: uppercase; }
        .discrepancy .disc-body { color: #B91C1C; font-size: 12px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        table th { background: #1B2A4A; color: #FFF; padding: 8px 12px; text-align: left; font-weight: 700; border: 1px solid #DDD; }
        table td { padding: 8px 12px; border: 1px solid #DDD; }
        table tr:nth-child(even) td { background: #F8FAFC; }
        .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 10px; }
        .signature-line { display: flex; justify-content: space-between; margin-top: 48px; }
        .sig-block { flex: 1; text-align: center; }
        .sig-block .line { border-bottom: 1px solid #94A3B8; margin: 32px 20px 8px; }
        .sig-block .name { font-size: 12px; font-weight: 600; color: #1E293B; }
        .sig-block .role { font-size: 10px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Trucks Sphere</h1>
        <div class="subtitle">Good Receipt Note (GRN)</div>
      </div>

      <div class="section">
        <div class="section-title">Document Details</div>
        <div class="row"><span class="label">Receipt Note</span><span class="value">${data.receiptNoteId || data.jobId}</span></div>
        <div class="row"><span class="label">Job ID</span><span class="value">${data.jobId}</span></div>
        <div class="row"><span class="label">Purchase Order</span><span class="value">${data.poNumber || 'N/A'}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${data.timestamp}</span></div>
        
      </div>

      <div class="section">
        <div class="section-title">Parties</div>
        <div class="row"><span class="label">Vendor</span><span class="value">${data.vendorName || 'N/A'}</span></div>
        <div class="row"><span class="label">Driver</span><span class="value">${data.driverName || 'N/A'}</span></div>
        <div class="row"><span class="label">Truck Plate</span><span class="value">${data.plateNumber || 'N/A'}</span></div>
        <div class="row"><span class="label">Origin (Quarry)</span><span class="value">${data.quarryName || 'N/A'}</span></div>
        <div class="row"><span class="label">Destination (Site)</span><span class="value">${data.siteName || 'N/A'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Material</div>
        <div class="row"><span class="label">Material</span><span class="value">${data.materialName || 'N/A'}</span></div>
        <div class="row"><span class="label">Quantity Ordered</span><span class="value">${data.quantityOrdered} tonnes</span></div>
      </div>

      <div class="section">
        <div class="section-title">Weight Record</div>
        <table>
          <tr><td>Site Arrival Weight (Gross)</td><td style="font-weight:700;">${data.weightIn.toFixed(1)} T</td></tr>
          <tr><td>Post-Offload Weight (Tare)</td><td style="font-weight:700;">${data.weightOut.toFixed(1)} T</td></tr>
        </table>

        <div class="highlight-box">
          <div class="net">${data.netWeight.toFixed(1)} Tonnes</div>
          <div class="calc">NET WEIGHT = ${data.weightIn.toFixed(1)}T (Gross) − ${data.weightOut.toFixed(1)}T (Tare)</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Certification</div>
        <div class="row"><span class="label">Operator</span><span class="value">${data.operatorName}</span></div>
        <div class="row"><span class="label">Location</span><span class="value">${data.siteName || 'Site'}</span></div>
      </div>

      <div class="signature-line">
        <div class="sig-block">
          <div class="line"></div>
          <div class="name">${data.operatorName}</div>
          <div class="role">Site Operator</div>
        </div>
        <div class="sig-block">
          <div class="line"></div>
          <div class="name">${data.driverName || 'Driver'}</div>
          <div class="role">Driver</div>
        </div>
      </div>

      <div class="footer">
        <p>Generated by Trucks Sphere on ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</p>
        <p>This is a computer-generated document.</p>
      </div>
    </body>
    </html>
  `;
}

/* ─────────── Phase 2: Weights Tab — Weight Out + GRN Generation ─────────── */

export default function OperatorSiteWeightsScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ─── Active weigh job state ───
  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightOutInput, setWeightOutInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Review / Receipt Modal ───
  const [reviewVisible, setReviewVisible] = useState(false);

  // ─── GRN / Receipt Modal ───
  const [grnVisible, setGrnVisible] = useState(false);
  const [grnData, setGrnData] = useState<any>(null);

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); const t = setInterval(() => loadData(true), 2000); return () => clearInterval(t); }, []);

  /* ─── Filtering & Categorizing ─── */

  // Only show jobs that have completed site weigh-in (status = 'weighed_in') or are still in progress
  const eligibleJobs = useMemo(() => {
    return deliveries.filter(
      (d) =>
        d.status !== 'cancelled' &&
        (d.siteWeighInWeight != null || d.status === 'weighed_in'),
    );
  }, [deliveries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return eligibleJobs.filter(
      (d) =>
        !q ||
        [d.jobId, d.driverName, d.plateNumber, d.materialName].some((v) =>
          String(v || '').toLowerCase().includes(q),
        ),
    );
  }, [eligibleJobs, search]);

  const stats = useMemo(() => {
    const pending = filtered.filter(
      (d) => d.status !== 'completed' && d.status !== 'delivered',
    );
    const completed = filtered.filter(
      (d) => d.status === 'completed' || d.status === 'delivered',
    );
    return { pending: pending.length, completed: completed.length };
  }, [filtered]);

  /* ─── Active Job Calculations ─── */

  const siteWeighIn = activeJob?.siteWeighInWeight ?? 0;
  const weightOutNum = parseFloat(weightOutInput);

  const netWeight =
    !isNaN(weightOutNum) && weightOutNum > 0 && siteWeighIn > 0
      ? siteWeighIn - weightOutNum
      : null;

  /* ─── Handlers ─── */

  const openWeighForm = (job: any) => {
    setActiveJob(job);
    setWeightOutInput('');
  };

  const closeWeighForm = () => {
    setActiveJob(null);
    setWeightOutInput('');
    setSaving(false);
  };

  const handleCalculateAndReview = () => {
    if (isNaN(weightOutNum) || weightOutNum <= 0) {
      Alert.alert(
        'Invalid Weight',
        'Please enter a valid Weight Out value.',
      );
      return;
    }
    if (weightOutNum >= siteWeighIn) {
      Alert.alert(
        'Invalid Weight',
        'Weight Out must be less than the Site Arrival Weight.',
      );
      return;
    }
    // Show receipt review note modal
    setReviewVisible(true);
  };

  const handleConfirmAndFinalize = async () => {
    if (!activeJob || netWeight === null) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      await updateDeliveryOrder(activeJob.id, {
        siteWeighOutWeight: weightOutNum,
        siteWeighOutAt: now,
        siteNetWeight: netWeight,
        quantityDelivered: netWeight,
        receivedAt: now,
        receivedLocation: activeJob.siteName || 'Site',
        receivedBy: 'Site Operator',
        status: 'completed',
        updatedAt: now,
      });

      // Update local
      const updatedJob = {
        ...activeJob,
        siteWeighOutWeight: weightOutNum,
        siteWeighOutAt: now,
        siteNetWeight: netWeight,
        quantityDelivered: netWeight,
        receivedAt: now,
        receivedBy: 'Site Operator',
        status: 'completed',
        updatedAt: now,
      };
      setDeliveries((current) =>
        current.map((item) =>
          item.id === activeJob.id ? updatedJob : item,
        ),
      );

      // Show GRN
      const receiptNoteId = generateReceiptNoteId(activeJob.jobId);
      setGrnData({
        ...updatedJob,
        receiptNoteId,
        siteWeighIn,
        weightOut: weightOutNum,
        netWeight,
      });
      setGrnVisible(true);
    } catch (error: any) {
      Alert.alert(
        'Finalization Failed',
        error?.message || 'Could not finalize the delivery.',
      );
    } finally {
      setSaving(false);
    }
  };

  /* ─── GRN Export Actions ─── */

  const buildGrnExportData = () => {
    if (!grnData) return null;
    return {
      jobId: grnData.jobId || '',
      receiptNoteId: grnData.receiptNoteId || '',
      poNumber: grnData.poNumber || '',
      driverName: grnData.driverName || '',
      plateNumber: grnData.plateNumber || '',
      vendorName: grnData.vendorName || '',
      materialName: grnData.materialName || '',
      quantityOrdered: grnData.quantityOrdered || 0,
      quarryName: grnData.quarryName || '',
      siteName: grnData.siteName || '',
      weightIn: siteWeighIn,
      weightOut: weightOutNum,
      netWeight: grnData.siteNetWeight || netWeight || 0,
      timestamp: new Date().toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
      }),
      operatorName: 'Site Operator',
    };
  };

  const handleDownloadPDF = async () => {
    const data = buildGrnExportData();
    if (!data) return;
    try {
      const html = buildReceiptHtml(data);
      await Share.share({
        message: html,
        title: `GRN_${data.receiptNoteId || data.jobId}`,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export Error', e?.message || 'Failed to share PDF');
      }
    }
  };

  const handleDownloadCSV = async () => {
    const data = buildGrnExportData();
    if (!data) return;
    try {
      const headers = [
        'Field',
        'Value',
      ];
      const rows = [
        ['Receipt Note', data.receiptNoteId || data.jobId],
        ['Job ID', data.jobId],
        ['Purchase Order', data.poNumber],
        ['Vendor', data.vendorName],
        ['Driver', data.driverName],
        ['Truck Plate', data.plateNumber],
        ['Material', data.materialName],
        ['Quantity Ordered', `${data.quantityOrdered} tonnes`],
        ['Origin (Quarry)', data.quarryName],
        ['Destination (Site)', data.siteName],
        ['Site Arrival Weight (Gross)', `${data.weightIn.toFixed(1)} T`],
        ['Weight Out (Tare)', `${data.weightOut.toFixed(1)} T`],
        ['Net Weight', `${data.netWeight.toFixed(1)} T`],
        ['Status', 'COMPLETED'],
        ['Operator', data.operatorName],
        ['Date', data.timestamp],
      ];
      const csv = formatCsv(headers, rows);
      await Share.share({
        message: csv,
        title: `GRN_${data.receiptNoteId || data.jobId}`,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export Error', e?.message || 'Failed to share CSV');
      }
    }
  };

  const handleShareGRN = async () => {
    const data = buildGrnExportData();
    if (!data) return;
    try {
      const html = buildReceiptHtml(data);
      await Share.share({
        message: html,
        title: `GRN_${data.receiptNoteId || data.jobId}`,
      });
    } catch {}
  };

  /* ─── Active Weigh Form View ─── */

  if (activeJob) {
    const quarryIn = activeJob.weighInWeight ?? 0;
    const quarryOut = activeJob.weighOutWeight ?? 0;
    const quarryNet =
      activeJob.netWeight ??
      (activeJob.weighInWeight != null && activeJob.weighOutWeight != null
        ? activeJob.weighInWeight - activeJob.weighOutWeight
        : null);

    return (
      <>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Job Card */}
          <View
            style={[
              styles.jobCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.jobCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobCardTitle, { color: colors.text }]}>
                  {activeJob.jobId}
                </Text>
                <Text style={[styles.jobPo, { color: colors.textMuted }]}>
                  {activeJob.poNumber || 'No PO'}
                </Text>
              </View>
          
            </View>
            <DetailRow
              icon="person-outline"
              value={`${activeJob.driverName || 'N/A'} · ${activeJob.plateNumber || 'N/A'}`}
            />
            <DetailRow
              icon="cube-outline"
              value={`${activeJob.materialName || 'Material'} · ${activeJob.quantityOrdered || 0} tonnes`}
            />
            <DetailRow
              icon="business-outline"
              value={`Vendor: ${activeJob.vendorName || 'N/A'}`}
            />
            <DetailRow
              icon="location-outline"
              value={`From: ${activeJob.quarryName || 'Quarry'} → ${activeJob.siteName || 'Site'}`}
            />

            {/* Section: Site Arrival Weight (already recorded) */}
            <View style={styles.divider} />
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              SITE ARRIVAL WEIGHT (RECORDED)
            </Text>
            <View
              style={[
                styles.recordedWeightBox,
                { backgroundColor: '#10B98108', borderColor: '#10B98133' },
              ]}
            >
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.recordedWeightLabel, { color: colors.textMuted }]}>
                  Gross Weight
                </Text>
                <Text style={[styles.recordedWeightValue, { color: '#10B981' }]}>
                  {siteWeighIn.toFixed(1)} Tonnes
                </Text>
              </View>
            </View>

            {/* Quarry Weight Summary (reference only) */}
            {quarryNet != null && (
              <>
                <View style={styles.divider} />
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  QUARRY WEIGHTS (REFERENCE)
                </Text>
                <View style={styles.quarryWeightRow}>
                  <View style={styles.qwCell}>
                    <Text style={[styles.qwLabel, { color: colors.textMuted }]}>Quarry In</Text>
                    <Text style={[styles.qwValue, { color: '#2563EB' }]}>
                      {quarryIn.toFixed(1)}T
                    </Text>
                  </View>
                  <View style={styles.qwCell}>
                    <Text style={[styles.qwLabel, { color: colors.textMuted }]}>Quarry Out</Text>
                    <Text style={[styles.qwValue, { color: '#7C3AED' }]}>
                      {quarryOut.toFixed(1)}T
                    </Text>
                  </View>
                  <View style={styles.qwCell}>
                    <Text style={[styles.qwLabel, { color: colors.textMuted }]}>Quarry Net</Text>
                    <Text style={[styles.qwValue, { color: colors.success }]}>
                      {quarryNet.toFixed(1)}T
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ─── Weight Out Input ─── */}
          <View
            style={[
              styles.stageLabel,
              { backgroundColor: '#8B5CF615', borderColor: '#8B5CF633' },
            ]}
          >
            <Ionicons name="arrow-up-outline" size={20} color="#8B5CF6" />
            <Text style={[styles.stageLabelText, { color: '#8B5CF6' }]}>
              INPUT POST-OFFLOAD WEIGHT (WEIGHT OUT)
            </Text>
          </View>

          <View
            style={[
              styles.inputCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.inputHeader}>
              <View
                style={[
                  styles.inputIcon,
                  { backgroundColor: '#8B5CF615' },
                ]}
              >
                <Ionicons name="scale-outline" size={22} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputTitle, { color: colors.text }]}>
                  Weight Out (Tare Weight)
                </Text>
                <Text style={[styles.inputSub, { color: colors.textMuted }]}>
                  Weigh the empty truck after offloading is complete.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.weightInputWrap,
                { borderColor: '#8B5CF6', backgroundColor: colors.inputBg },
              ]}
            >
              <TextInput
                style={[styles.weightInput, { color: colors.text }]}
                placeholder="0.0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={weightOutInput}
                onChangeText={setWeightOutInput}
                autoFocus
              />
              <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>
                Tonnes
              </Text>
            </View>

            {/* Live Calculation Preview */}
            {netWeight !== null && netWeight > 0 && (
              <View
                style={[
                  styles.netPreview,
                  { backgroundColor: '#8B5CF608', borderColor: '#8B5CF633' },
                ]}
              >
                <Text style={[styles.netLabel, { color: colors.textMuted }]}>
                  NET WEIGHT
                </Text>
                <Text style={[styles.netValue, { color: '#8B5CF6' }]}>
                  {netWeight.toFixed(1)} Tonnes
                </Text>
                <Text style={[styles.netCalc, { color: colors.textTertiary }]}>
                  {siteWeighIn.toFixed(1)}T (Gross) − {weightOutNum.toFixed(1)}T (Tare)
                </Text>


              </View>
            )}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  weightOutNum > 0 &&
                  netWeight !== null &&
                  netWeight > 0 &&
                  !saving
                    ? '#8B5CF6'
                    : colors.border,
              },
            ]}
            onPress={handleCalculateAndReview}
            disabled={
              saving ||
              isNaN(weightOutNum) ||
              weightOutNum <= 0 ||
              weightOutNum >= siteWeighIn
            }
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="calculator-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.submitBtnText}>
              {saving ? 'Processing...' : 'Calculate & Review'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={closeWeighForm}
            disabled={saving}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>

        {/* ─── Receipt Review Note Modal ─── */}
        <Modal
          visible={reviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.grnDialog,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.grnIconWrap,
                  { backgroundColor: '#8B5CF615' },
                ]}
              >
                <Ionicons name="receipt-outline" size={36} color="#8B5CF6" />
              </View>

              <Text style={[styles.grnTitle, { color: colors.text }]}>
                Receipt Note
              </Text>
              <Text style={[styles.grnSub, { color: colors.textMuted }]}>
                Review the weight calculations below before finalizing.
              </Text>

              {/* Receipt Summary */}
              <View
                style={[
                  styles.grnSummary,
                  { backgroundColor: colors.inputBg },
                ]}
              >
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Job ID
                  </Text>
                  <Text style={[styles.grnValue, { color: colors.text }]}>
                    {activeJob.jobId}
                  </Text>
                </View>
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Driver
                  </Text>
                  <Text style={[styles.grnValue, { color: colors.text }]}>
                    {activeJob.driverName} · {activeJob.plateNumber}
                  </Text>
                </View>
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Material
                  </Text>
                  <Text style={[styles.grnValue, { color: colors.text }]}>
                    {activeJob.materialName}
                  </Text>
                </View>
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Vendor
                  </Text>
                  <Text style={[styles.grnValue, { color: colors.text }]}>
                    {activeJob.vendorName}
                  </Text>
                </View>
                <View style={styles.grnDivider} />
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Site Arrival (Gross)
                  </Text>
                  <Text style={[styles.grnValue, { color: '#F59E0B' }]}>
                    {siteWeighIn.toFixed(1)} T
                  </Text>
                </View>
                <View style={styles.grnRow}>
                  <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                    Weight Out (Tare)
                  </Text>
                  <Text style={[styles.grnValue, { color: '#8B5CF6' }]}>
                    {weightOutNum.toFixed(1)} T
                  </Text>
                </View>
                <View style={[styles.grnDivider, { marginTop: 4 }]} />
                <View style={styles.grnRow}>
                  <Text
                    style={[
                      styles.grnLabel,
                      { color: colors.textMuted, fontWeight: '800' },
                    ]}
                  >
                    Net Weight
                  </Text>
                  <Text
                    style={[
                      styles.grnValue,
                      { color: colors.success, fontWeight: '900', fontSize: 18 },
                    ]}
                  >
                    {netWeight !== null ? netWeight.toFixed(1) : '—'} T
                  </Text>
                </View>
              </View>

              {/* Review Actions */}
              <View style={styles.grnActions}>
                <TouchableOpacity
                  style={[styles.grnActionBtn, { flex: 1, backgroundColor: colors.border }]}
                  onPress={() => setReviewVisible(false)}
                >
                  <Text style={[styles.grnActionText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.grnActionBtn, { flex: 2, backgroundColor: '#8B5CF6' }]}
                  onPress={() => {
                    setReviewVisible(false);
                    handleConfirmAndFinalize();
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.grnActionText}>Confirm & Finalize</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── GRN Success Modal ─── */}
        <Modal
          visible={grnVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setGrnVisible(false);
            closeWeighForm();
          }}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.grnDialog,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.grnIconWrap,
                  { backgroundColor: '#10B98115' },
                ]}
              >
                <Ionicons name="receipt" size={40} color="#10B981" />
              </View>

              <Text style={[styles.grnTitle, { color: colors.text }]}>
                Good Receipt Note
              </Text>
              <Text style={[styles.grnSub, { color: colors.textMuted }]}>
                Delivery finalized successfully. GRN generated.
              </Text>

              {/* GRN Summary */}
              {grnData && (
                <View
                  style={[
                    styles.grnSummary,
                    { backgroundColor: colors.inputBg },
                  ]}
                >
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Receipt Note
                    </Text>
                    <Text style={[styles.grnValue, { color: '#8B5CF6', fontWeight: '800' }]}>
                      {grnData.receiptNoteId || grnData.jobId}
                    </Text>
                  </View>
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Job ID
                    </Text>
                    <Text style={[styles.grnValue, { color: colors.text }]}>
                      {grnData.jobId}
                    </Text>
                  </View>
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Driver
                    </Text>
                    <Text style={[styles.grnValue, { color: colors.text }]}>
                      {grnData.driverName} · {grnData.plateNumber}
                    </Text>
                  </View>
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Material
                    </Text>
                    <Text style={[styles.grnValue, { color: colors.text }]}>
                      {grnData.materialName}
                    </Text>
                  </View>
                  <View style={styles.grnDivider} />
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Gross (Site In)
                    </Text>
                    <Text style={[styles.grnValue, { color: '#F59E0B' }]}>
                      {siteWeighIn.toFixed(1)} T
                    </Text>
                  </View>
                  <View style={styles.grnRow}>
                    <Text style={[styles.grnLabel, { color: colors.textMuted }]}>
                      Tare (Weight Out)
                    </Text>
                    <Text style={[styles.grnValue, { color: '#8B5CF6' }]}>
                      {weightOutNum.toFixed(1)} T
                    </Text>
                  </View>
                  <View style={[styles.grnDivider, { marginTop: 4 }]} />
                  <View style={styles.grnRow}>
                    <Text
                      style={[
                        styles.grnLabel,
                        { color: colors.textMuted, fontWeight: '800' },
                      ]}
                    >
                      Net Weight
                    </Text>
                    <Text
                      style={[
                        styles.grnValue,
                        { color: colors.success, fontWeight: '900', fontSize: 18 },
                      ]}
                    >
                      {(grnData.siteNetWeight || netWeight || 0).toFixed(1)} T
                    </Text>
                  </View>
                </View>
              )}

              {/* Export Actions */}
              <View style={styles.grnActions}>
                <TouchableOpacity
                  style={[styles.grnActionBtn, { backgroundColor: '#2563EB' }]}
                  onPress={handleDownloadPDF}
                >
                  <Ionicons name="document-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.grnActionText}>Download PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.grnActionBtn, { backgroundColor: '#7C3AED' }]}
                  onPress={handleDownloadCSV}
                >
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.grnActionText}>Download CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.grnActionBtn, { backgroundColor: '#059669' }]}
                  onPress={handleShareGRN}
                >
                  <Ionicons name="share-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.grnActionText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Dismiss */}
              <TouchableOpacity
                style={[styles.grnDoneBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setGrnVisible(false);
                  closeWeighForm();
                }}
              >
                <Text
                  style={[
                    styles.grnDoneText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  /* ─── List View ─── */

  return (
    <PageShell
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          tintColor={colors.primary}
        />
      }
    >
     

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      <SectionTitle
        title={`${filtered.length} trucks ready for weigh out`}
      />

      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Loading...
          </Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const siteIn = item.siteWeighInWeight ?? 0;
          const isCompleted =
            item.status === 'completed' || item.status === 'delivered';
          const siteNet = item.siteNetWeight ?? item.quantityDelivered ?? null;
          const diff = item.siteWeightDifference ?? null;

          return (
            <DataCard
              key={item.id}
              onPress={() => !isCompleted && openWeighForm(item)}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: colors.text,
                  }}
                >
                  {item.jobId}
                </Text>
             
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || 'N/A'} · ${item.plateNumber || 'N/A'}`}
              />
              <DetailRow
                icon="cube-outline"
                value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`}
              />

              {/* Site Arrival Weight Badge */}
              <View
                style={[
                  styles.listWeightBadge,
                  { backgroundColor: '#10B98112' },
                ]}
              >
                <Ionicons
                  name="download-outline"
                  size={12}
                  color="#10B981"
                />
                <Text
                  style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}
                >
                  Site Arrival: {siteIn.toFixed(1)} T
                </Text>
              </View>

              {/* If completed, show net + diff */}
              {isCompleted && siteNet != null && (
                <View
                  style={[
                    styles.listNetBadge,
                    { backgroundColor: '#8B5CF610' },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-circle"
                    size={12}
                    color="#8B5CF6"
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#8B5CF6',
                    }}
                  >
                    Net: {siteNet.toFixed(1)}T
                    {diff != null
                      ? `  (Δ ${diff > 0 ? '+' : ''}${diff.toFixed(1)}T)`
                      : ''}
                  </Text>
                </View>
              )}

              {!isCompleted && (
                <View
                  style={[
                    styles.tapHint,
                    { backgroundColor: `${colors.primary}08` },
                  ]}
                >
                  <Ionicons
                    name="hand-left-outline"
                    size={12}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.tapHintText,
                      { color: colors.primary },
                    ]}
                  >
                    Tap to input Weight Out & finalize
                  </Text>
                </View>
              )}

              <Text
                style={{
                  fontSize: 14,
                  color: colors.textTertiary,
                }}
              >
                {isCompleted
                  ? `Finalized: ${formatEAT(item.receivedAt || item.updatedAt)}`
                  : `Arrived: ${formatEAT(item.siteWeighInAt || item.updatedAt)}`}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="scale-outline"
          title="No trucks ready"
          subtitle="Complete 'Weight In' from the Schedule tab first."
        />
      )}

      <View style={{ height: Spacing['4xl'] }} />
    </PageShell>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  metricRow: { flexDirection: 'row', gap: Spacing.sm },
  // Job Card
  jobCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  jobPo: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  recordedWeightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  recordedWeightLabel: { fontSize: 11, fontWeight: '700' },
  recordedWeightValue: { fontSize: 18, fontWeight: '800' },
  quarryWeightRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  qwCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  qwLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  qwValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  // Stage Labels
  stageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  stageLabelText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Input
  inputCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputTitle: { fontSize: 16, fontWeight: '700' },
  inputSub: { fontSize: 12, marginTop: 2 },
  weightInputWrap: {
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  weightInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  weightSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  // Net Preview
  netPreview: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  netLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  netValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  netCalc: { fontSize: 12, marginTop: 4 },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  diffLabel: { fontSize: 12, fontWeight: '600' },
  diffValue: { fontSize: 13, fontWeight: '800' },
  mismatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  mismatchText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    lineHeight: 14,
  },
  // Buttons
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    minHeight: 50,
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
  // List
  listWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  listNetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 6,
  },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // GRN Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  grnDialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.xl,
    maxHeight: '90%',
  },
  grnIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  grnTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  grnSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  grnSummary: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 6,
  },
  grnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  grnLabel: { fontSize: 12, fontWeight: '600' },
  grnValue: { fontSize: 13, fontWeight: '700' },
  grnDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  grnActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  grnActionBtn: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  grnActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  grnDoneBtn: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grnDoneText: { fontSize: 14, fontWeight: '700' },
});