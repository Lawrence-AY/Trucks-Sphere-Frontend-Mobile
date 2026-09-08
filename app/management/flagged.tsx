import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { clearTrackingFlag, fetchTrackingFlags } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import { isDeliveryFlagged, isSiteWeightFlagged, getDeliveryFlagReason } from '../../utils/siteFlags';

export default function FlaggedScreen() {
  const colors = useTheme();
  const role = useAuthStore((state) => state.user?.role);
  const deliveries = useDeliveryOrders();
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [reason, setReason] = useState(''); const [loadError, setLoadError] = useState(''); const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const load = useCallback(async () => { setLoading(true); setLoadError(''); try { setItems(await fetchTrackingFlags()); } catch (error: any) { setLoadError(error?.message || 'Unable to load flagged deliveries.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const canClear = ['admin', 'admin_edit', 'superadmin', 'super_admin'].includes(String(role || '').toLowerCase());
  const displayItems = useMemo(() => {
    const localFlags = deliveries.filter((item: any) => isDeliveryFlagged(item) || item.securityFlag?.status === 'cleared');
    const byId = new Map<string, any>();
    [...items, ...localFlags].forEach((item) => {
      const previous = byId.get(String(item.id));
      if (!previous || String(item.updatedAt || '') >= String(previous.updatedAt || '')) byId.set(String(item.id), item);
    });
    return [...byId.values()].map((item: any) => {
      const flag = isSiteWeightFlagged(item) && item.securityFlag?.status !== 'flagged' ? null : item.securityFlag;
      if (!flag?.status) {
        const flaggedAt = item.siteFlaggedAt || item.siteArrivalWeightCapturedAt || item.flaggedAt || item.updatedAt || item.createdAt;
        return { ...item, securityFlag: flag, flagReason: getDeliveryFlagReason(item), flaggedAtText: flaggedAt ? formatEAT(flaggedAt) : '' };
      }
      const location = flag.flagLocation || flag.securityLocation || '';
      const locationText = typeof location === 'string'
        ? location
        : [location?.latitude, location?.longitude].filter((value) => value != null).join(', ');
      const details = [
        flag.reason || 'Security review is required.',
      ].filter(Boolean).join('\n');
      return { ...item, securityFlag: { ...flag, reason: details }, flagLocationText: locationText, flaggedAtText: flag.flaggedAt ? formatEAT(flag.flaggedAt) : '', clearedAtText: flag.clearedAt ? formatEAT(flag.clearedAt) : '' };
    });
  }, [deliveries, items]);
  const clear = async (id: string) => {
    if (!reason.trim()) return Alert.alert('Reason required', 'Enter a reason for clearing this flag.');
    try {
      const updated = await clearTrackingFlag(id, reason.trim());
      const sync = useRealTimeSyncStore.getState();
      sync.optimisticUpdate('deliveryOrders', updated);
      if (updated.driverId) sync.optimisticUpdate('drivers', { id: updated.driverId, status: 'active', securityFlag: updated.securityFlag });
      if (updated.vehicleId) sync.optimisticUpdate('vehicles', { id: updated.vehicleId, status: 'active', securityFlag: updated.securityFlag });
      setItems((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
      setSelectedItem((current: any) => current?.id === id ? { ...current, ...updated } : current);
      setReason('');
    } catch (e: any) { Alert.alert('Unable to clear flag', e?.response?.data?.error || 'Please try again.'); }
  };
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <FlatList data={displayItems} refreshing={loading} onRefresh={load} keyExtractor={(item) => item.id}
      ListEmptyComponent={!loading ? <Text style={{ color: loadError ? colors.danger : colors.textMuted, textAlign: 'center', marginTop: 48 }}>{loadError || 'No flagged deliveries.'}</Text> : <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />}
      renderItem={({ item }) => { const securityFlagged = item.securityFlag?.status === 'flagged'; const securityCleared = item.securityFlag?.status === 'cleared'; return <View style={[styles.card, { backgroundColor: securityFlagged ? '#FFFBEB' : colors.surface, borderColor: securityFlagged ? '#B45309' : securityCleared ? '#A78BFA' : '#DC2626' }]}><TouchableOpacity activeOpacity={0.75} onPress={() => setSelectedItem(item)}><Text style={[styles.name, { color: colors.text }]}>{item.plateNumber || 'Truck'} · {item.driverName || 'Driver'}</Text><Text style={{ color: colors.textSecondary }}>{item.vendorName || 'Vendor'}</Text><Text style={[styles.reason, { color: securityCleared ? '#6D28D9' : colors.danger }]}>{securityCleared ? 'Security flag cleared — fleet unsuspended' : item.securityFlag?.reason || item.flagReason || 'Weight variance flagged'}</Text>{item.flaggedAtText ? <Text style={[styles.flaggedAt, { color: colors.textMuted }]}>Flagged at: {item.flaggedAtText}</Text> : null}{item.clearedAtText ? <Text style={[styles.flaggedAt, { color: colors.textMuted }]}>Unsuspended at: {item.clearedAtText}</Text> : null}</TouchableOpacity>{canClear && securityFlagged ? <><TextInput value={reason} onChangeText={setReason} placeholder="Reason for clearing" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /><TouchableOpacity onPress={() => clear(item.id)} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={styles.buttonText}>Clear flag & unsuspend fleet</Text></TouchableOpacity></> : null}</View>}} />
    <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}><TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedItem(null)}><TouchableOpacity activeOpacity={1} style={[styles.detailModal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}><Text style={[styles.detailTitle, { color: colors.text }]}>Flag history</Text><Text style={[styles.detailName, { color: colors.text }]}>{selectedItem?.plateNumber || 'Truck'} · {selectedItem?.driverName || 'Driver'}</Text><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Reason</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem?.securityFlag?.reason || selectedItem?.flagReason || selectedItem?.differenceNote || 'Weight variance flagged'}</Text><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Flagged by</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem?.securityFlag?.flaggedBy || selectedItem?.siteFlaggedBy || 'Site weight check'}</Text>{selectedItem?.flagLocationText ? <><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Flagged from</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem.flagLocationText}</Text></> : null}<Text style={[styles.detailLabel, { color: colors.textMuted }]}>Flagged at</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem?.flaggedAtText || '—'}</Text>{selectedItem?.securityFlag?.status === 'cleared' ? <><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Unsuspended by</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem.securityFlag.clearedBy || 'Administrator'}</Text><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Unsuspended at</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem.clearedAtText || '—'}</Text><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Clearance reason</Text><Text style={[styles.detailValue, { color: colors.text }]}>{selectedItem.securityFlag.resolutionReason || '—'}</Text></> : null}<TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primary }]} onPress={() => setSelectedItem(null)}><Text style={styles.buttonText}>Close</Text></TouchableOpacity></TouchableOpacity></TouchableOpacity></Modal>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: Spacing.lg }, title: { fontSize: 24, fontWeight: '800', marginBottom: 4 }, card: { borderWidth: 1.5, borderColor: '#B45309', borderRadius: Radius.lg, padding: Spacing.md, marginTop: 0, marginBottom: 0, gap: 6 }, name: { fontSize: 16, fontWeight: '800' }, reason: { fontWeight: '700', marginTop: 4 }, flaggedAt: { fontSize: 11, fontWeight: '400', marginTop: 2 }, input: { borderWidth: 1, borderRadius: Radius.md, padding: 10, marginTop: 8 }, button: { alignItems: 'center', borderRadius: Radius.md, padding: 11 }, buttonText: { color: '#fff', fontWeight: '800' }, modalBackdrop: { flex: 1, justifyContent: 'center', padding: Spacing.lg, backgroundColor: 'rgba(15,23,42,0.45)' }, detailModal: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs }, detailTitle: { fontSize: 20, fontWeight: '800' }, detailName: { fontSize: 15, fontWeight: '700' }, detailLabel: { fontSize: 11, fontWeight: '700', marginTop: Spacing.xs, textTransform: 'uppercase' }, detailValue: { fontSize: 13, lineHeight: 19 }, closeButton: { alignItems: 'center', borderRadius: Radius.md, padding: 11, marginTop: Spacing.md } });
