import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ScrollView, Share, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, updateDeliveryOrder } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import { DataCard, DetailRow, EmptyState, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

type Tab = 'receive' | 'schedule' | 'history';

export default function SiteScreen() {
  const colors = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('receive');
  const [search, setSearch] = useState('');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchDeliveryOrders();
      setDeliveries(data || []);
    } catch (err) {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleReceive = async () => {
    if (!selected || saved) return;
    setSaving(true);
    try {
      const deliveredQty = Number(selected.quantity || selected.quantityOrdered || selected.netWeight || 0);
      await updateDeliveryOrder(selected.id || selected.jobId, {
        status: 'delivered',
        quantityDelivered: deliveredQty,
        receivedAt: new Date().toISOString(),
        deliveryNote: deliveryNote || undefined,
      });
      setSaved(true);
      loadData();
    } catch (err) {
    } finally {
      setSaving(false);
    }
  };

  const pendingDeliveries = useMemo(() => {
    return deliveries.filter((d: any) =>
      ['in_transit', 'in_transit_to_site', 'arrived', 'at_quarry', 'loaded', 'assigned', 'weighed_in', 'weighed_out'].includes(d.status)
    );
  }, [deliveries]);

  const receivedDeliveries = useMemo(() => {
    return deliveries.filter((d: any) =>
      ['delivered', 'completed', 'received', 'confirmed'].includes(d.status)
    );
  }, [deliveries]);

  const allDeliveries = useMemo(() => {
    return deliveries.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }, [deliveries]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    let list: any[] = [];
    if (activeTab === 'receive') list = pendingDeliveries;
    else if (activeTab === 'schedule') list = deliveries;
    else list = allDeliveries;

    if (!query) return list;
    return list.filter((d: any) =>
      (d.jobId || '').toLowerCase().includes(query) ||
      (d.plateNumber || d.truckPlate || '').toLowerCase().includes(query) ||
      (d.materialName || d.material || '').toLowerCase().includes(query) ||
      (d.vendorName || '').toLowerCase().includes(query)
    );
  }, [activeTab, pendingDeliveries, deliveries, allDeliveries, search]);

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: 'receive', label: 'Receive', icon: 'download-outline', count: pendingDeliveries.length },
    { key: 'schedule', label: 'Schedule', icon: 'calendar-outline', count: deliveries.length },
    { key: 'history', label: 'History', icon: 'time-outline', count: receivedDeliveries.length },
  ];

  const handleSelectDelivery = (item: any) => {
    setSelected(item);
    setSaved(false);
    setDeliveryNote('');
  };

  const handleBackToList = () => {
    setSelected(null);
    setSaved(false);
    setDeliveryNote('');
  };

  // --- Receipt View ---
  if (selected) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBackToList}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back to list</Text>
        </TouchableOpacity>

        <DataCard>
          <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
            <View style={[styles.receiptIcon, { backgroundColor: '#10B98112' }]}>
              <Ionicons name="document-text" size={28} color="#10B981" />
            </View>
            <Text style={[styles.receiptTitle, { color: colors.text }]}>DELIVERY RECEIPT</Text>
            <Text style={[styles.receiptSub, { color: colors.textMuted }]}>
              {saved ? 'Received & Confirmed' : 'Confirm Delivery Receipt'}
            </Text>
          </View>

          <DetailRow icon="document-outline" value={`Job: ${selected.jobId}`} />
          <DetailRow icon="business-outline" value={`Vendor: ${selected.vendorName}`} />
          <DetailRow icon="person-outline" value={`Driver: ${selected.driverName}`} />
          <DetailRow icon="car-outline" value={`Truck: ${selected.plateNumber || selected.truckPlate || 'N/A'}`} />
          <DetailRow icon="cube-outline" value={`Material: ${selected.materialName || selected.material} · ${selected.quantityOrdered || selected.quantity || 0} tonnes`} />
          <DetailRow icon="navigate-outline" value={`${selected.quarryName || 'Origin'} → ${selected.siteName || 'Destination'}`} />
          <DetailRow icon="time-outline" value={formatEAT(selected.updatedAt || selected.createdAt)} />

          {/* Delivery Note */}
          <View style={[styles.noteWrap, { borderTopColor: colors.border }]}>
            <Text style={[styles.noteLabel, { color: colors.text }]}>Delivery Note:</Text>
            <TextInput
              style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg || colors.background }]}
              placeholder="Add a note about this delivery..."
              placeholderTextColor={colors.textTertiary}
              value={deliveryNote}
              onChangeText={setDeliveryNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {saved ? (
            <View style={[styles.confirmedBadge, { backgroundColor: '#10B98112', borderColor: '#10B98133' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>RECEIVED & CONFIRMED</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: '#10B981' }]}
              onPress={handleReceive}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
              <Text style={styles.confirmBtnText}>{saving ? 'Saving...' : 'Confirm Receipt'}</Text>
            </TouchableOpacity>
          )}
        </DataCard>
      </ScrollView>
    );
  }

  // --- List View ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon as any} size={16} color={isActive ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? colors.primary : colors.textMuted }]}>
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search job, truck, material, vendor..." />

        <SectionTitle title={`${filtered.length} ${activeTab === 'receive' ? 'pending' : activeTab === 'history' ? 'received' : 'scheduled'} deliveries`} />

        {loading ? (
          <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading deliveries...</Text></DataCard>
        ) : filtered.length ? (
          filtered.map((item) => (
            <DataCard key={item.id || item.jobId} onPress={() => handleSelectDelivery(item)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: item.status === 'in_transit' || item.status === 'in_transit_to_site' ? '#F59E0B15' : '#10B98115' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: item.status === 'in_transit' || item.status === 'in_transit_to_site' ? '#F59E0B' : '#10B981' }}>
                    {item.status === 'in_transit' || item.status === 'in_transit_to_site' ? 'IN TRANSIT' : item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'N/A'} · ${item.plateNumber || item.truckPlate || 'N/A'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || item.material || 'Material'} `} />
               <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          ))
        ) : (
          <EmptyState
            icon={activeTab === 'receive' ? 'download-outline' : activeTab === 'history' ? 'checkmark-done-outline' : 'calendar-outline'}
            title={activeTab === 'receive' ? 'No pending deliveries' : activeTab === 'history' ? 'No received deliveries' : 'No scheduled deliveries'}
            subtitle={search ? 'Try a different search term.' : 'Deliveries will appear here.'}
          />
        )}
      </PageShell>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing['4xl'] },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md },
  tabLabel: { fontSize: 13, fontWeight: '700' },
  tabBadge: { minWidth: 20, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  backText: { fontSize: 16, fontWeight: '600' },
  receiptIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  receiptTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  receiptSub: { fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  noteWrap: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1 },
  noteLabel: { fontSize: 13, fontWeight: '700', marginBottom: Spacing.sm },
  noteInput: { fontSize: 14, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, minHeight: 70, textAlignVertical: 'top' },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderWidth: 1, borderRadius: Radius.md, marginTop: Spacing.md },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.md },
  confirmBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});