import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { fetchMaterials } from '../../services/api';
import { CommandHeader, DataCard, DetailRow, EmptyState, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

export default function OperatorSiteMaterialsScreen() {
  const colors = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      setMaterials((await fetchMaterials()) || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter((m) => !q || (m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q));
  }, [materials, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Inventory" title="Materials" subtitle={`${materials.length} materials`} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search material..." />
      <SectionTitle title={`${filtered.length} materials`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
            <DetailRow icon="pricetag-outline" value={`${item.unitPrice || 0} KES / ${item.unit || 'unit'}`} />
            <DetailRow icon="folder-outline" value={item.category || 'Uncategorized'} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials" subtitle="No materials found." />
      )}
    </PageShell>
  );
}