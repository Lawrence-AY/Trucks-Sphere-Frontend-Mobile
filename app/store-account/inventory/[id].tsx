import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchStockMovements, fetchStocks, recordStockMovement } from '../../../services/api';
import { useTheme } from '../../../hooks/useTheme';
import { Gap } from '../../../constants/theme';

export default function InventoryDetailScreen() {
  const colors = useTheme();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const routeId = Array.isArray(id) ? id[0] : id;
  const [stock, setStock] = useState<any>();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const load = async () => {
    const all = await fetchStocks();
    const matched = all.find((item) => String(item.id) === String(routeId));
    setStock(matched);
    if (matched) setMovements(await fetchStockMovements(String(matched.id)));
  };
  useEffect(() => { void load(); }, [routeId]);
  const record = async () => { try { await recordStockMovement(String(stock.id), { type: 'usage', quantity: Number(quantity), unit: stock.unit === 'sets' ? 'pieces' : stock.unit, reason }); setQuantity(''); setReason(''); await load(); Alert.alert('Saved', 'Material out recorded.'); } catch (error: any) { Alert.alert('Unable to save', error?.message || 'Try again.'); } };
  if (!stock) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Loading inventory detail…</Text></View>;
  const available = stock.unit === 'sets' ? `${stock.remainingSets ?? 0} Sets + ${stock.remainingLoosePieces ?? 0} Pieces (${stock.remainingBasePieces ?? 0} Total Pieces)` : `${stock.remainingQuantity ?? 0} ${stock.unit || ''}`;
  return <View style={[styles.page, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.text }]}>{stock.materialName || 'Material'}</Text><Text style={{ color: colors.textMuted }}>Available: {available}</Text><TextInput inputAccessoryViewID="trucksphere-keyboard-done" style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder={stock.unit === 'sets' ? 'Pieces to issue' : 'Quantity'} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} /><TextInput inputAccessoryViewID="trucksphere-keyboard-done" style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Reason / reference" placeholderTextColor={colors.textMuted} value={reason} onChangeText={setReason} /><View style={styles.actions}><Button title="Record material out" color="#DC2626" onPress={() => void record()} /></View><Text style={[styles.heading, { color: colors.text }]}>Movement history</Text>{movements.length ? movements.map((movement) => <View key={movement.id} style={styles.movement}><Text style={{ color: colors.text, fontWeight: '700' }}>{movement.type === 'receipt' ? 'Material in' : 'Material out'} · {movement.quantity ?? 0} {movement.quantityUnit || movement.unit || ''}</Text><Text style={{ color: colors.textMuted }}>{movement.reason || '—'}</Text><Text style={{ color: colors.textMuted }}>{movement.createdAt ? new Date(movement.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}{movement.actorName ? ` · ${movement.actorName}` : ''}</Text></View>) : <Text style={{ color: colors.textMuted }}>No movements recorded yet.</Text>}</View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 20 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 25, fontWeight: '800', marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12 }, actions: { gap: Gap, marginTop: 14 }, heading: { fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 12 }, movement: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1 } });
