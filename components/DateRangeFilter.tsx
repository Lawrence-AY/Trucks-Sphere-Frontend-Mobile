import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Gap, Radius, Spacing } from '../constants/theme';

function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1); }
function monthStart() { const date = new Date(); return isoDate(new Date(date.getFullYear(), date.getMonth(), 1)); }
function today() { return isoDate(new Date()); }
export type DateRange = { startDate: string; endDate: string };
export function defaultDateRange(): DateRange { return { startDate: monthStart(), endDate: today() }; }

export function isInDateRange(value: any, range: DateRange | null): boolean {
  if (!range) return true;
  const date = typeof value?.toDate === 'function' ? value.toDate() : value && typeof value === 'object' && typeof value.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value);
  if (!value || Number.isNaN(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  const key = `${get('year')}-${get('month')}-${get('day')}`;
  return (!range.startDate || key >= range.startDate) && (!range.endDate || key <= range.endDate);
}

function CalendarField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const colors = useTheme(); const [open, setOpen] = useState(false); const [month, setMonth] = useState(() => parseDate(value));
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  return <>
    <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Choose ${label}`} onPress={() => setOpen(true)} style={[styles.field, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><Text style={{ color: colors.text }}>{value}</Text><Text style={{ color: colors.textMuted }}>▾</Text></TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.backdrop} onPress={() => setOpen(false)}><Pressable style={[styles.modal, { backgroundColor: colors.surface }]} onPress={() => {}}>
      <View style={styles.monthHeader}><TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={{ color: colors.primary, fontSize: 22 }}>‹</Text></TouchableOpacity><Text style={[styles.monthTitle, { color: colors.text }]}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={{ color: colors.primary, fontSize: 22 }}>›</Text></TouchableOpacity></View>
      <View style={styles.week}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <Text key={day}>{day}</Text>)}</View><View style={styles.grid}>{cells.map((day, index) => <View key={index} style={styles.cell}>{day ? <TouchableOpacity style={[styles.day, isoDate(new Date(month.getFullYear(), month.getMonth(), day)) === value && { backgroundColor: colors.primary }]} onPress={() => { onChange(isoDate(new Date(month.getFullYear(), month.getMonth(), day))); setOpen(false); }}><Text style={{ color: isoDate(new Date(month.getFullYear(), month.getMonth(), day)) === value ? colors.onPrimary : colors.text }}>{day}</Text></TouchableOpacity> : null}</View>)}</View>
    </Pressable></Pressable></Modal>
  </>;
}

export function DateRangeFilter({ value, onApply }: { value: DateRange; onApply: (range: DateRange) => void }) {
  const colors = useTheme(); const defaults = useMemo(defaultDateRange, []); const [draft, setDraft] = useState(value);
  const update = (key: keyof DateRange, next: string) => setDraft(current => ({ ...current, [key]: next })); const apply = () => { if (draft.startDate <= draft.endDate) onApply(draft); }; const reset = () => { setDraft(defaults); onApply(defaults); };
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>Report date range</Text><View style={styles.row}><View style={styles.flex}><CalendarField label="Start date" value={draft.startDate} onChange={value => update('startDate', value)} /></View><View style={styles.flex}><CalendarField label="End date" value={draft.endDate} onChange={value => update('endDate', value)} /></View></View><View style={styles.actions}><TouchableOpacity onPress={apply} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Apply Filter</Text></TouchableOpacity><TouchableOpacity onPress={reset} style={[styles.button, { borderColor: colors.border, borderWidth: 1 }]}><Text style={{ color: colors.text, fontWeight: '700' }}>Reset Filter</Text></TouchableOpacity></View></View>;
}

const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm }, title: { fontSize: 14, fontWeight: '800', marginBottom: Spacing.xs }, row: { flexDirection: 'row', gap: Gap }, flex: { flex: 1 }, label: { fontSize: 12, marginBottom: 4 }, field: { minHeight: 42, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, actions: { flexDirection: 'row', gap: Gap, marginTop: Spacing.sm }, button: { minHeight: 40, paddingHorizontal: Spacing.md, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg }, modal: { borderRadius: Radius.lg, padding: Spacing.md }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, monthTitle: { fontWeight: '800' }, week: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: Spacing.sm }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285%', alignItems: 'center', minHeight: 40 }, day: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' } });
