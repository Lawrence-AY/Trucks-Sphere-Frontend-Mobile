import { Image, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { receivedLines, receivingDate, receivingStatusLabel } from '../utils/storeReceiving';

export function StoreReceiptDetails({ job }: { job: any }) {
  const colors = useTheme();
  const receipt = job.storeReceiving;
  const metadata = [
    ['Status', receivingStatusLabel(job)], ['Received (EAT)', receivingDate(receipt?.receivedAt)],
    ['Vendor', receipt?.vendorName || job.vendorName], ['Driver', receipt?.driverName || job.driverName],
    ['Truck', receipt?.plateNumber || job.plateNumber], ['Delivered by', receipt?.deliveredByName || job.driverName],
    ['Received by', receipt?.receivedByName], ['Initial condition', receipt?.condition],
  ];
  return <View style={{ gap: 10 }}>
    {metadata.map(([label, value]) => <Text key={label} style={{ color: colors.text }}>{label}: {value || '—'}</Text>)}
    {job.receivingFlag?.status === 'flagged' ? <Text style={{ color: colors.danger, fontWeight: '700' }}>Flagged: {job.receivingFlag.reason}</Text> : null}
    {receivedLines(job).map((line, index) => <View key={index} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border, gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'}</Text>
      <Text style={{ color: colors.text }}>Received: {line.receivedQuantity} {line.unit} · Ordered: {line.orderedQuantity}</Text>
      {(line.photoURLs || []).map((uri: string) => <Image key={uri} accessibilityLabel={`Received ${line.materialName || 'material'} photo`} source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 220, backgroundColor: colors.background, borderRadius: 8 }} />)}
    </View>)}
  </View>;
}
