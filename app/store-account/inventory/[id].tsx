import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchStockMovements, fetchStocks, recordStockMovement } from '../../../services/api';
import { useTheme } from '../../../hooks/useTheme';
import { Gap } from '../../../constants/theme';
import { useMaterials } from '../../../store/realtimeData';
import { formatStoreQuantity, storeMaterialUnit } from '../../../utils/storeReceiving';

export default function InventoryDetailScreen() {
  const colors = useTheme();
  const materials = useMaterials();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const routeId = Array.isArray(id) ? id[0] : id;
  const [stock, setStock] = useState<any>();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const all = await fetchStocks();
    const matched = all.find((item) => String(item.id) === String(routeId));
    setStock(matched);
    if (matched) setMovements(await fetchStockMovements(String(matched.id)));
  }, [routeId]);
  useFocusEffect(useCallback(() => {
    setQuantity('');
    setReason('');
    void load();
  }, [load]));
  const detailStock = useMemo(() => {
    if (!stock) return null;
    const material = materials.find((entry: any) =>
      [entry.id, entry.materialId].filter(Boolean).some((materialId: string) => String(materialId).toLowerCase() === String(stock.materialId || '').toLowerCase())
      || String(entry.name || entry.materialName || '').trim().toLowerCase() === String(stock.materialName || '').trim().toLowerCase(),
    );
    return { ...material, ...stock, category: stock.category || material?.category || material?.materialCategory, materialCategory: stock.materialCategory || material?.materialCategory || material?.category };
  }, [stock, materials]);
  const unit = detailStock ? storeMaterialUnit(detailStock, detailStock.unit || '') : 'units';
  const record = async () => {
    if (!detailStock || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || !reason.trim() || saving) return;
    setSaving(true);
    try {
      await recordStockMovement(String(detailStock.id), { type: 'usage', quantity: Number(quantity), unit: unit.toLowerCase() === 'sets' ? 'pieces' : unit.toLowerCase(), reason: reason.trim() });
      setQuantity(''); setReason(''); await load(); Alert.alert('Saved', 'Material issue recorded.');
    } catch (error: any) { Alert.alert('Unable to save', error?.message || 'Try again.'); }
    finally { setSaving(false); }
  };
  if (!detailStock) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textMuted, marginTop: 10 }}>Loading inventory detail…</Text></View>;
  const isSets = unit.toLowerCase() === 'sets';
  const category = detailStock.materialCategory || detailStock.category || 'Material';
  const available = isSets
    ? `${detailStock.remainingSets ?? 0} sets + ${detailStock.remainingLoosePieces ?? 0} pieces`
    : `${formatStoreQuantity(detailStock.remainingQuantity ?? 0, unit)} ${unit}`;
  const canSave = Number(quantity) > 0 && Boolean(reason.trim()) && !saving;
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}16` }]}><Ionicons name="cube-outline" size={20} color={colors.primary} /></View>
      <Text style={[styles.title, { color: colors.text }]}>{detailStock.materialName || 'Material'}</Text>
      <Text style={{ color: colors.textMuted }}>{category} · {detailStock.siteName || 'Unassigned site'} · {unit}</Text>
      <View style={[styles.available, { backgroundColor: colors.inputBg }]}><View style={{ flex: 1 }}><Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>AVAILABLE STOCK</Text>{isSets ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{detailStock.remainingBasePieces ?? 0} total pieces</Text> : null}</View><Text style={[styles.availableValue, { color: colors.primary }]}>{available}</Text></View>
    </View>

    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Record material issue</Text>
      <Text style={[styles.help, { color: colors.textMuted }]}>Enter the amount taken from store and the job or reason for the issue.</Text>
      <Text style={[styles.label, { color: colors.text }]}>Quantity ({isSets ? 'pieces' : unit})</Text>
      <TextInput accessibilityLabel="Quantity to issue" inputAccessoryViewID="trucksphere-keyboard-done" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} placeholder={isSets ? 'Pieces to issue' : `Quantity in ${unit}`} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
      <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Reason or reference</Text>
      <TextInput accessibilityLabel="Reason or reference for issue" inputAccessoryViewID="trucksphere-keyboard-done" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} placeholder="For example, job card or work area" placeholderTextColor={colors.textMuted} value={reason} onChangeText={setReason} />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={() => void record()} style={[styles.action, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.5 }]}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="arrow-up-circle-outline" size={20} color={colors.onPrimary} />}
        <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{saving ? 'Saving…' : 'Record issue'}</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.historyHeader}><Text style={[styles.heading, { color: colors.text }]}>Movement history</Text><Text style={{ color: colors.textMuted }}>{movements.length} {movements.length === 1 ? 'record' : 'records'}</Text></View>
    {movements.length ? movements.map((movement) => {
      const received = movement.type === 'receipt';
      return <View key={movement.id} style={[styles.movement, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.movementIcon, { backgroundColor: received ? `${colors.success}16` : `${colors.danger}16` }]}><Ionicons name={received ? 'arrow-down' : 'arrow-up'} size={18} color={received ? colors.success : colors.danger} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{received ? 'Material received' : 'Material issued'}</Text><Text style={{ color: received ? colors.success : colors.danger, fontWeight: '700' }}>{formatStoreQuantity(movement.quantity ?? 0, movement.quantityUnit || movement.unit || unit)} {movement.quantityUnit || movement.unit || unit}</Text><Text style={{ color: colors.textMuted }}>{movement.reason || 'No reason provided'}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>{movement.createdAt ? new Date(movement.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}{movement.actorName ? ` · ${movement.actorName}` : ''}</Text></View>
      </View>;
    }) : <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="time-outline" size={22} color={colors.textMuted} /><Text style={{ color: colors.textMuted, marginTop: 8 }}>No movements recorded yet.</Text></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: Gap, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 3 },
  available: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 8, marginTop: 10 },
  availableValue: { fontSize: 20, fontWeight: '900', textAlign: 'right' },
  section: { borderWidth: 1, borderRadius: 16, padding: 16 },
  heading: { fontSize: 18, fontWeight: '900' },
  help: { marginTop: 5, marginBottom: 14, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  action: { minHeight: 48, borderRadius: 10, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  movement: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 13 },
  movementIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 18 },
});
