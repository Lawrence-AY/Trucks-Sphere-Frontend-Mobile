import { usePurchaseOrders } from '../store/realtimeData';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTripMaterials } from '../utils/poMaterials';
import { useTheme } from '../hooks/useTheme';
export function TripMaterials({ trip }: { trip: any }) {
 const colors = useTheme();
 const [expanded, setExpanded] = useState(false);
 const orders = usePurchaseOrders();
 const lines = getTripMaterials(trip, orders);
 if (lines.length < 2) return <Text style={{ color: colors.text }}>{lines[0]?.materialName || 'Material'}</Text>;
 return <View>
 <TouchableOpacity accessibilityRole="button" accessibilityLabel="View trip materials" accessibilityState={{ expanded }} onPress={(event) => { event.stopPropagation(); setExpanded(!expanded); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
 <Text style={{ color: colors.text, fontWeight: '700' }}>{lines.length} materials</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
 </TouchableOpacity>
 {expanded && <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>{lines.map((line, index) => <Text key={`${line.materialId || ''}-${index}`} style={{ color: colors.text, paddingVertical: 4 }}>{line.materialName || line.productName || 'Material'}{line.quantity != null ? ' - ' + line.quantity + ' ' + (line.unit || '') : ''}</Text>)}</ScrollView>}
 </View>;
}
