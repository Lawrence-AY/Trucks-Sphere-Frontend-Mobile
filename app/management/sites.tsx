import { BackButton } from '../../components/ui/BackButton';
/**
 * Site Management Screen - List and manage delivery sites
 *
 * Features:
 *   - List all sites with location and status
 *   - Search and filter
 *   - View site details
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchSites, updateSite } from '../../services/api';
import { DetailRow } from '../../components/EnterpriseUI';
import { formatEAT } from '../../utils/helpers';
import { ManagementSearchHeader } from '../../components/ManagementSearchHeader';

export default function SitesScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const insets = useSafeAreaInsets();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [savingSiteId, setSavingSiteId] = useState<string | null>(null);
  const [saveErrorSiteId, setSaveErrorSiteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await fetchSites();
      setSites(data || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function setWeighbridgeUnit(site: any, unit: 'kg' | 'tonnes') {
    setSavingSiteId(site.id);
    setSaveErrorSiteId(null);
    try {
      await updateSite(site.id, { weighbridgeWeightUnit: unit });
      setSites((current) => current.map((item) =>
        item.id === site.id ? { ...item, weighbridgeWeightUnit: unit } : item
      ));
    } catch {
      setSaveErrorSiteId(site.id);
    } finally {
      setSavingSiteId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return sites;
    const q = search.toLowerCase();
    return sites.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.location?.address || item.location || '').toLowerCase().includes(q)
    );
  }, [sites, search]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Sites</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ManagementSearchHeader title="Sites" search={search} onChangeSearch={setSearch} placeholder="Search sites..." />
      <View style={[styles.backBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} style={styles.backBtn} />
        <Text style={[styles.backTitle, { color: colors.text }]}>Sites</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.count, { color: colors.textMuted }]}>
            {sites.length} site{sites.length !== 1 ? 's' : ''}
          </Text>
        </View>

      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="trail-sign-outline" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name || 'Unnamed Site'}</Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {item.location?.address || item.location || 'No address'}
                </Text>
              </View>
              <Badge label={item.status || 'active'} variant={item.status === 'active' ? 'success' : 'default'} size="sm" />
            </View>
            {item.contact ? (
              <DetailRow icon="person-outline" value={`Contact: ${item.contact}`} />
            ) : null}
            {item.phone ? (
              <DetailRow icon="call-outline" value={item.phone} />
            ) : null}
            <View style={styles.unitRow}>
              <View style={styles.unitCopy}>
                <Text style={[styles.unitLabel, { color: colors.text }]}>Weighbridge unit</Text>
                <Text style={[styles.unitHint, { color: colors.textMuted }]}>
                  {item.weighbridgeWeightUnit || 'Not configured'}
                </Text>
              </View>
              <View style={[styles.unitControl, { borderColor: colors.border, backgroundColor: colors.background }]}>
                {(['kg', 'tonnes'] as const).map((unit) => {
                  const selected = item.weighbridgeWeightUnit === unit;
                  return (
                    <TouchableOpacity
                      key={unit}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${item.name || 'site'} weighbridge unit to ${unit}`}
                      disabled={savingSiteId === item.id}
                      onPress={() => void setWeighbridgeUnit(item, unit)}
                      style={[styles.unitOption, selected && { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.unitOptionText, { color: selected ? '#FFFFFF' : colors.textMuted }]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {saveErrorSiteId === item.id ? (
              <Text style={[styles.unitError, { color: colors.danger }]}>Could not save weighbridge unit.</Text>
            ) : null}
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
              Created: {item.createdAt ? formatEAT(item.createdAt) : '—'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="location-outline"
            title="No sites found"
            subtitle={search ? 'Try a different search term' : 'Delivery sites will appear here once configured'}
          />
        }
      />
    </View>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: { flex: 1 },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 4,
  },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs},
  title: { fontSize: 24, fontWeight: '800' },
  count: { fontSize: 13, marginTop: Spacing.xs},
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Gap, marginBottom: Spacing.xs},
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs},
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Gap, marginBottom: Spacing.xs},
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs},
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.md },
  unitCopy: { flex: 1 },
  unitLabel: { fontSize: 13, fontWeight: '700' },
  unitHint: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  unitControl: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, padding: 3, gap: 2 },
  unitOption: { minWidth: 58, minHeight: 34, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm },
  unitOptionText: { fontSize: 12, fontWeight: '700' },
  unitError: { fontSize: 12, marginTop: Spacing.xs },
  timestamp: { fontSize: 12, marginTop: Spacing.xs},
});
