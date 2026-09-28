import { usePurchaseOrders } from '@/store/realtimeData';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPurchaseOrderMaterials, getTripMaterials } from '../utils/poMaterials';
import { useTheme } from '../hooks/useTheme';

export function TripMaterials({ trip }: { trip: any }) {
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const orders = usePurchaseOrders();
  const order = orders.find((po) => trip.purchaseOrderId && String(po.id) === String(trip.purchaseOrderId)) || orders.find((po) => trip.poNumber && po.poNumber === trip.poNumber);
  const lines = order ? getPurchaseOrderMaterials(order) : getTripMaterials(trip, orders);

  return <View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="View trip materials" accessibilityState={{ expanded }} onPress={(event) => { event.stopPropagation(); setExpanded(true); }} style={styles.trigger}>
      {lines.length > 1 ? <Ionicons name="layers-outline" size={17} color={colors.text} /> : null}
      <Text style={{ color: colors.text, fontWeight: '700' }}>{lines.length === 1 ? lines[0].materialName || lines[0].productName || 'Material' : lines.length + ' materials'}</Text>
      {lines.length > 1 ? <Ionicons name="chevron-down" size={16} color={colors.text} /> : null}
    </TouchableOpacity>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close materials" style={StyleSheet.absoluteFill} onPress={(event) => { event.stopPropagation(); setExpanded(false); }} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Trip materials ({lines.length})</Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>{trip.jobId || trip.jobCardNumber || 'Trip'}</Text>
              {trip.poNumber ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>{trip.poNumber}</Text> : null}
              {trip.driverName ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>Driver: {trip.driverName}</Text> : null}
              {trip.plateNumber ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>Truck: {trip.plateNumber}</Text> : null}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close materials" onPress={(event) => { event.stopPropagation(); setExpanded(false); }} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator>
            {lines.map((line, index) => <View key={(line.materialId || '') + '-' + index} style={[styles.item, { borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>{line.materialName || line.productName || 'Material'}</Text>
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 520, maxHeight: '80%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '800' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  item: { padding: 14, borderWidth: 1, borderRadius: 10 },
  name: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
});
