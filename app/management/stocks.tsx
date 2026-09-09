import { Redirect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, Stack } from 'expo-router';
import { Text, View, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import api, { downloadCategoryCSV } from '../../services/api';
import { StackScreen } from '../../components/ui/StackScreen';
import { DataCard } from '../../components/EnterpriseUI';
import { useTheme } from '../../hooks/useTheme';


export default function StocksUnavailable() { return <Redirect href="/management/dashboard" />; }

function StocksScreen() {
  const colors = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exceptions, setExceptions] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('');
  const [reason, setReason] = useState('');
  const [request, setRequest] = useState<{ key: string; id: string } | null>(null);
  const loadVersion = useRef(0);
  const savingRef = useRef(false);
  const load = useCallback(async (silent = false) => {
    const version = ++loadVersion.current;
    if (!silent) { setLoading(true); setError(''); }
    try { const res = await api.get<{ data: any[] }>('/api/stocks'); if (version === loadVersion.current) { setRows(res.data.data); setError(''); } }
    catch (e: any) { if (version === loadVersion.current) setError(e.message || 'Unable to load stocks'); }
    finally { if (!silent) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); const timer = setInterval(() => { if (!savingRef.current) void load(true); }, 5000); return () => { clearInterval(timer); loadVersion.current++; }; }, [load]));
  const open = async (row: any) => {
    setSelected(row); setEvents([]); setQuantity(''); setCost(row.unitCost == null ? '' : String(row.unitCost)); setCurrency(row.currency || ''); setReason(''); setRequest(null);
    try { const res = await api.get<{ data: any[] }>(`/api/stocks/${row.id}/movements`); setEvents(res.data.data); }
    catch (e: any) { setError(e.message); }
  };
  const save = async (type: string) => {
    if (!selected || loading || savingRef.current) return;
    savingRef.current = true;
    const body = { type, quantity, unitCost: cost, currency, reason };
    const key = JSON.stringify([selected.id, body]);
    const requestId = request?.key === key ? request.id : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    setRequest({ key, id: requestId }); setLoading(true); setError('');
    try {
      await api.post(`/api/stocks/${selected.id}/movements`, { ...body, requestId });
      setSelected(null); setQuantity(''); setReason(''); setRequest(null); await load();
    } catch (e: any) { setError(e.message || 'Unable to save'); }
    finally { savingRef.current = false; setLoading(false); }
  };
  const visible = rows.filter((r) => `${r.siteName} ${r.materialName} ${r.jobId} ${r.poNumber}`.toLowerCase().includes(search.toLowerCase()) && (!exceptions || r.excessQuantity > 0 || r.shortageQuantity > 0 || r.quarantinedQuantity > 0));
  const balances = Object.values(visible.reduce((totals: Record<string, any>, row) => {
    const key = JSON.stringify([row.siteId || row.siteName, row.materialId || row.materialName, row.unit]);
    const total = totals[key] ||= { key, siteName: row.siteName, materialName: row.materialName, unit: row.unit, available: 0, damaged: 0 };
    total.available += Number(row.remainingQuantity) || 0;
    total.damaged += Number(row.quarantinedQuantity) || 0;
    return totals;
  }, {}));
  const values = visible.reduce((totals: Record<string, number>, r) => { if (r.remainingValue != null) totals[r.currency] = (totals[r.currency] || 0) + r.remainingValue; return totals; }, {});
  return <>
    <Stack.Screen options={{ title: 'Stocks', headerShown: false }} />
    <StackScreen title="Site stocks" subtitle="Cumulative balances by site, material and unit" fallbackHref="/management/dashboard">
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textMuted }}>Available stock excludes damaged units and recorded usage. Subsequent shipments add to each material balance. Enter a unit cost to value each receipt. Unpriced stock is excluded from valuation totals.</Text>
        {rows.length > 0 ? <>
        <TextInput mode="outlined" label="Search site, product, PO or job" value={search} onChangeText={setSearch} />
        <Button onPress={() => setExceptions(!exceptions)}>{exceptions ? 'Show all stocks' : 'Show shortages, excess and quarantine'}</Button>
        <Button onPress={() => downloadCategoryCSV('stocks').catch((e: any) => setError(e.message))}>Export stock CSV</Button>
        </> : null}
        <Button disabled={loading} loading={loading} onPress={() => load()}>Refresh balances</Button>
        <Text style={{ color: colors.text }}>{visible.length} stock lines · {visible.filter((r) => r.unitCost == null).length} unpriced</Text>
        {Object.entries(values).map(([unit, value]) => <Text key={unit} style={{ color: colors.text }}>Remaining value: {unit} {Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>)}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        {selected ? <Modal visible transparent animationType="slide" onRequestClose={() => !loading && setSelected(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}><DataCard>
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <Text style={{ color: colors.text }}>{selected.materialName} · {selected.jobId} · {selected.remainingQuantity} {selected.unit} available</Text>
          <TextInput label="Usage quantity" keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
          <TextInput label="Unit cost" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
          <TextInput label="Currency (e.g. KES)" autoCapitalize="characters" value={currency} onChangeText={setCurrency} />
          <TextInput label="Reason / usage reference" value={reason} onChangeText={setReason} />
          <Button disabled={loading} onPress={() => save('usage')}>Record usage</Button>
          <Button disabled={loading} onPress={() => save('valuation')}>Save valuation</Button>
          <Button disabled={loading} onPress={() => setSelected(null)}>Close</Button>
          <Text style={{ color: colors.text }}>Audit history</Text>
          {events.map((event) => <Text key={event.id} style={{ color: colors.textMuted }}>{event.createdAt} · {event.actorName} · {event.type} · {event.quantity} · {event.reason}</Text>)}
        </DataCard></ScrollView></KeyboardAvoidingView></Modal> : null}
        {!loading && !error && !visible.length ? <Text style={{ color: colors.textMuted }}>{rows.length ? 'No stocks match these filters.' : 'No stock records yet. Stocks appear automatically from app deliveries and site receipts.'}</Text> : null}
        {balances.map((total) => <DataCard key={total.key}><Text style={{ color: colors.text, fontWeight: '700' }}>{total.materialName} ? {total.siteName}</Text><Text style={{ color: colors.text }}>Available: {Number(total.available.toFixed(6))} {total.unit} ? Damaged / quarantined: {Number(total.damaged.toFixed(6))}</Text></DataCard>)}
        {visible.map((r) => <DataCard key={r.id} onPress={() => open(r)}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{r.materialName} · {r.siteName}</Text>
          <Text style={{ color: colors.textMuted }}>{r.jobId} · {r.origin} · {r.receiptStatus}</Text>
          <Text style={{ color: colors.text }}>Sent: {r.dispatchedQuantity} · Inspected received: {r.receivedQuantity} {r.unit}</Text>
          <Text style={{ color: colors.text }}>Damaged / quarantined: {r.quarantinedQuantity} ? Used: {r.consumedQuantity} · Remaining: {r.remainingQuantity} {r.unit}</Text>
          <Text style={{ color: colors.text }}>Value: {r.remainingValue == null ? 'Unpriced' : `${r.currency} ${r.remainingValue}`}</Text>
          <Text style={{ color: colors.textMuted }}>Accepted by: {r.acceptedBy || 'Pending'} · Inspector: {r.inspectorName || 'Pending'}</Text>
          {r.excessQuantity > 0 || r.shortageQuantity > 0 || r.quarantinedQuantity > 0 ? <Text style={{ color: colors.danger }}>Excess: {r.excessQuantity} · Shortage: {r.shortageQuantity} · Quarantined: {r.quarantinedQuantity} {r.unit}</Text> : null}
        </DataCard>)}
      </View>
    </StackScreen>
  </>;
}
