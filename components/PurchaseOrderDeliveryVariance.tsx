import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { usePurchaseOrders } from '../store/realtimeData';

type DeliveryTotal = { unit: string; orderedQuantity: number; deliveredQuantity: number; variance: number; overDelivered: boolean };
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });

function Totals({ totals }: { totals: DeliveryTotal[] }) {
  const colors = useTheme();
  return <View style={{ gap: 4 }}>
    {totals.map((total) => <View key={total.unit} style={{ gap: 3 }}>
      <Text style={{ color: colors.text }}>Delivered: {format(total.deliveredQuantity)} / Ordered: {format(total.orderedQuantity)} {total.unit}</Text>
      <Text style={{ color: total.overDelivered ? colors.danger : colors.textMuted, fontWeight: '700' }}>
        Delivery variance: {total.variance > 0 ? '+' : ''}{format(total.variance)} {total.unit}{total.overDelivered ? ' (over-delivered)' : ''}
      </Text>
    </View>)}
  </View>;
}

export function PurchaseOrderDeliveryVariance({ order }: { order: any }) {
  const orders = usePurchaseOrders();
  const current = orders.find((item) => item.id === order?.id) || order;
  const totals = current?.deliverySummary?.totals;
  return totals?.length ? <View style={{ marginVertical: 8 }}><Totals totals={totals} /></View> : null;
}

/** PO summaries are computed server-side from all linked trips, without pagination. */
export function PurchaseOrderDeliveryAlerts() {
  const orders = usePurchaseOrders();
  const colors = useTheme();
  const exceeded = orders.filter((order) => order.deliverySummary?.overDelivered);
  if (!exceeded.length) return null;
  return <View accessibilityRole="alert" style={{ gap: 10, marginVertical: 12 }}>
    <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '800' }}>Purchase order delivery alerts</Text>
    {exceeded.map((order) => <TouchableOpacity key={order.id} accessibilityRole="button"
      accessibilityLabel={`View over-delivered purchase order ${order.poNumber || order.id}`}
      onPress={() => router.push(`/screens/purchase-order?id=${encodeURIComponent(order.id)}` as any)}
      style={{ padding: 12, gap: 8, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface, borderRadius: 8 }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{order.poNumber || order.id}</Text>
      <Totals totals={order.deliverySummary.totals.filter((total: DeliveryTotal) => total.overDelivered)} />
    </TouchableOpacity>)}
  </View>;
}
