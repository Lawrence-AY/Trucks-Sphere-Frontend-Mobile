import { Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { DataCard, SectionTitle } from './EnterpriseUI';

export function FulfilledPurchaseOrders({ orders }: { orders: any[] }) {
  const colors = useTheme();
  const fulfilled = orders.filter(order => ['completed', 'delivered', 'fulfilled'].includes(String(order.status).toLowerCase()));
  return <View style={{ gap: 12, marginVertical: 16 }}>
    <SectionTitle title={`Fulfilled Purchase Order Reports (${fulfilled.length})`} />
    {!fulfilled.length ? <Text style={{ color: colors.textMuted }}>No fulfilled purchase orders yet.</Text> : fulfilled.map(order => <DataCard key={order.id}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{order.poNumber || order.id}</Text>
      <Text style={{ color: colors.textMuted }}>{order.vendorName || ''}</Text>
      {(order.deliverySummary?.materials || order.deliverySummary?.totals || []).map((line: any, index: number) => <View key={index} style={{ gap: 4 }}>
        <Text style={{ color: colors.text }}>{line.materialName || 'Material'}: {line.deliveredQuantity} / {line.orderedQuantity} {line.unit}</Text>
        {Number(line.excessQuantity ?? line.variance) > 0 ? <Text style={{ color: colors.danger, fontWeight: '700' }}>EXCESS: {line.excessQuantity ?? line.variance} {line.unit}</Text> : null}
      </View>)}
    </DataCard>)}
  </View>;
}
