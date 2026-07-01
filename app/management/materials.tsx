import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { fetchMaterials } from '../../services/api';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function ManagementMaterialsScreen() {
  const colors = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const materialData = await fetchMaterials();
      setMaterials(materialData || []);
    } catch (error) {
      console.error('Materials load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return materials.filter((item) => {
      const matchesSearch = !query || [item.name, item.category]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesSearch;
    });
  }, [materials, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search material, category..." />
      <SectionTitle title={`${filtered.length} materials`} />

      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading materials...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <View style={styles.cardHead}>
              <View style={styles.cardCopy}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.subtle, { color: colors.textMuted }]}>
                  {item.category || 'Material'} · {item.unit || 'tons'}
                </Text>
              </View>
            </View>
            <DetailRow icon="cube-outline" value={`Unit: ${item.unit || 'tons'}`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials found" subtitle="Try another search term or refresh the data." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
});