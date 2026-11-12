import { Image, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { formatStoreQuantity, receivedLines, receivingDate, receivingStatusLabel, storeMaterialUnit } from '../utils/storeReceiving';

export function StoreReceiptDetails({ job, hideMeta, hideReceived, hideQuantities, compact }: { job: any; hideMeta?: boolean; hideReceived?: boolean; hideQuantities?: boolean; compact?: boolean }) {
  const colors = useTheme();
  const receipt = job.storeReceiving;
  const metadata = [
    ...(!hideReceived ? [['Received (EAT)', receivingDate(receipt?.receivedAt)]] : []),
    ['Status', job.receivingStatus === 'inventory_added' ? 'Approved' : receivingStatusLabel(job)],
    ...(job.receivingStatus === 'inventory_added' ? [['Approved (EAT)', receivingDate(job.materialInspection?.inspectedAt)]] : []),
    ...(!hideMeta ? [['Vendor', receipt?.vendorName || job.vendorName], ['Driver', receipt?.driverName || job.driverName], ['Truck', receipt?.plateNumber || job.plateNumber], ['Delivered by', receipt?.deliveredByName || job.driverName], ['Received by', receipt?.receivedByName]] : []),
    ['Initial condition', receipt?.condition],
  ];
  return <View style={{ gap: compact ? 4 : 10 }}>
    {metadata.map(([label, value]) => <Text key={label} style={{ color: colors.text }}>{label}: {value || '—'}</Text>)}
    {job.receivingFlag?.status === 'flagged' ? <Text style={{ color: colors.danger, fontWeight: '700' }}>Flagged: {job.receivingFlag.reason}</Text> : null}
    {receivedLines(job).map((line, index) => {
      const unit = storeMaterialUnit(line, line.unit || '');
      return <View key={index} style={{ paddingVertical: compact ? 4 : 12, borderBottomWidth: 1, borderColor: colors.border, gap: compact ? 4 : 8 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'}</Text>
      {!hideQuantities ? <Text style={{ color: colors.text }}>Received: {formatStoreQuantity(line.receivedQuantity, unit)} {unit}{line.orderedQuantity != null ? ` · Ordered: ${formatStoreQuantity(line.orderedQuantity, unit)} ${unit}` : ''}</Text> : null}
      {(line.photoURLs || []).map((uri: string) => <Image key={uri} accessibilityLabel={`Received ${line.materialName || 'material'} photo`} source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 220, backgroundColor: colors.background, borderRadius: 8 }} />)}
    </View>;
    })}
  </View>;
}
