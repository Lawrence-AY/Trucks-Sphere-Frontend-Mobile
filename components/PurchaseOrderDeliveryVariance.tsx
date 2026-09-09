import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { usePurchaseOrders } from '../store/realtimeData';

type DeliveryTotal = { materialId?: string; materialName?: string; unit: string; orderedQuantity: number; deliveredQuantity: number; variance: number; overDelivered: boolean };
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });

function Totals({ totals }: { totals: DeliveryTotal[] }) {
  const colors = useTheme();
  return <View style={{ gap: 4 }}>
    {totals.map((total) => <View key={`${total.materialId || total.materialName || "total"}:${total.unit}`} style={{ gap: 3 }}>
      {total.materialName ? <Text style={{ color: colors.text, fontWeight: '700' }}>{total.materialName}</Text> : null}
        <Text>
           Ordered: {format(total.orderedQuantity)} {total.unit}</Text>
      <Text style={{ color: colors.text }}>Delivered: {format(total.deliveredQuantity)} 
          </Text>
      {total.deliveredQuantity !== 0 ? <Text style={{ color: total.overDelivered ? colors.danger : colors.textMuted, fontWeight: '700' }}>
        Delivery variance: {total.variance > 0 ? '+' : ''}{format(total.variance)} {total.unit}{total.overDelivered ? ' (over-delivered)' : ''}
      </Text> : null}
    </View>)}
  </View>;
}

export function PurchaseOrderDeliveryVariance({ order }: { order: any }) {
  const orders = usePurchaseOrders();
  const current = orders.find((item) => item.id === order?.id) || order;
  const colors = useTheme();
  const summary = current?.deliverySummary;
  const totals = summary?.materials?.length ? summary.materials : summary?.totals;
  const unmatched = summary?.materials?.length && summary.totals?.some((total: DeliveryTotal) => Math.abs(total.deliveredQuantity - summary.materials.filter((line: DeliveryTotal) => line.unit === total.unit).reduce((sum: number, line: DeliveryTotal) => sum + line.deliveredQuantity, 0)) > 0.000001);
  return totals?.length ? <View style={{ marginVertical: 8, gap: 6 }}>{!summary?.materials?.length ? <Text style={{ color: colors.textMuted }}>Combined totals by unit | material breakdown pending.</Text> : null}<Totals totals={totals} />{unmatched ? <><Text style={{ color: colors.danger }}>Some completed deliveries could not be matched to a PO material. Material figures exclude those quantities; combined totals follow.</Text><Totals totals={summary.totals} /></> : null}</View> : null;
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
