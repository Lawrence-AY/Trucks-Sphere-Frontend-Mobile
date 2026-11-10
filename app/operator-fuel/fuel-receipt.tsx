import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { fetchFuelRecords } from '../../services/api';
import { PageShell } from '../../components/EnterpriseUI';
import { useTheme } from '../../hooks/useTheme';
import { formatEAT } from '../../utils/helpers';

export default function FuelReceiptScreen() {
  const colors = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFuelRecords({ limit: 500 })
      .then((items) => setReceipt(items.find((item) => item.id === id) || items[0] || null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageShell><ActivityIndicator color={colors.primaryText} /></PageShell>;
  if (!receipt) return <PageShell><Text style={{ color: colors.text }}>Fuel receipt not found.</Text></PageShell>;

  const Row = ({ label, value }: { label: string; value: any }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' }}>{String(value || 'N/A')}</Text>
    </View>
  );
  const html = `<!doctype html><html><body style="font-family:Arial;padding:28px;color:#1E293B"><h1>Fuel Receipt</h1><p><b>Status:</b> Completed</p><hr/>${[
    ['Receipt ID', receipt.id], ['Receipt Note', receipt.receiptNoteId], ['Job ID', receipt.jobId],
    ['Driver', receipt.driverName], ['Truck', receipt.plateNumber], ['Vendor', receipt.vendorName],
    ['Fuel dispensed', `${Number(receipt.fuelAmount || 0).toFixed(1)} L`],
    ['Price per litre', receipt.pricePerLiter ? `KES ${Number(receipt.pricePerLiter).toFixed(2)}` : 'N/A'],
    ['Total cost', `KES ${Number(receipt.totalCost || 0).toFixed(2)}`], ['Dispensed', formatEAT(receipt.dispensedAt || receipt.createdAt)],
  ].map(([label, value]) => `<p><span style="color:#64748B">${label}</span><br/><b>${value || 'N/A'}</b></p>`).join('')}</body></html>`;
  const printReceipt = async () => {
    try { await Print.printAsync({ uri: (await Print.printToFileAsync({ html })).uri }); }
    catch (error: any) { Alert.alert('Print failed', error?.message || 'Could not print the fuel receipt.'); }
  };
  const saveReceipt = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save fuel receipt' });
      else Alert.alert('Receipt saved', uri);
    } catch (error: any) { Alert.alert('Save failed', error?.message || 'Could not save the fuel receipt.'); }
  };

  return (
    <PageShell>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>Fuel Receipt</Text>
        <Text style={{ color: colors.success, fontWeight: '800', marginTop: 4 }}>Completed</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity onPress={printReceipt} style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: colors.onPrimary, textAlign: 'center', fontWeight: '800' }}>Print receipt</Text></TouchableOpacity>
          <TouchableOpacity onPress={saveReceipt} style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: colors.success }}><Text style={{ color: colors.onPrimary, textAlign: 'center', fontWeight: '800' }}>Save receipt</Text></TouchableOpacity>
        </View>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 16 }}>
          <Row label="Receipt ID" value={receipt.id} />
          <Row label="Receipt Note" value={receipt.receiptNoteId} />
          <Row label="Job ID" value={receipt.jobId} />
          <Row label="Driver" value={receipt.driverName} />
          <Row label="Truck" value={receipt.plateNumber} />
          <Row label="Vendor" value={receipt.vendorName} />
          <Row label="Fuel dispensed" value={`${Number(receipt.fuelAmount || 0).toFixed(1)} L`} />
          <Row label="Price per litre" value={receipt.pricePerLiter ? `KES ${Number(receipt.pricePerLiter).toFixed(2)}` : 'N/A'} />
          <Row label="Total cost" value={`KES ${Number(receipt.totalCost || 0).toFixed(2)}`} />
          <Row label="Dispensed" value={formatEAT(receipt.dispensedAt || receipt.createdAt)} />
        </View>
      </ScrollView>
    </PageShell>
  );
}
