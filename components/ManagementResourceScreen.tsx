import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/theme';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from './EnterpriseUI';

type IconName = keyof typeof Ionicons.glyphMap;

type ResourceScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: IconName;
  searchPlaceholder: string;
  fetcher: () => Promise<any[]>;
  getTitle?: (item: any) => string;
  getSubtitle?: (item: any) => string;
  getDetails?: (item: any) => { icon: IconName; label?: string; value: string }[];
  getStatus?: (item: any) => string | undefined;
  emptyTitle: string;
};

function defaultTitle(item: any): string {
  return item.name || item.displayName || item.companyName || item.id || 'Untitled';
}

function defaultSubtitle(item: any): string {
  return item.description || item.category || item.email || item.status || 'No additional details';
}

export default function ManagementResourceScreen({
  eyebrow,
  title,
  subtitle,
  icon,
  searchPlaceholder,
  fetcher,
  getTitle = defaultTitle,
  getSubtitle = defaultSubtitle,
  getDetails,
  getStatus,
  emptyTitle,
}: ResourceScreenProps) {
  const colors = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setRefreshing(true);
    try {
      setItems((await fetcher()) || []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [getTitle(item), getSubtitle(item), item.id, item.status, item.email, item.phone]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [items, search, getTitle, getSubtitle]);

  const activeCount = items.filter((item) => item.status === 'active' || item.active === true).length;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <View style={styles.metrics}>
        <MetricTile icon={icon} label="Total records" value={items.length} tone={colors.primary} />
        <MetricTile icon="checkmark-circle-outline" label="Active" value={activeCount} tone={colors.success} />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder={searchPlaceholder} />
      <SectionTitle title={`${filtered.length} records`} />

      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading {title.toLowerCase()}...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const details = getDetails?.(item) || [
            { icon: 'information-circle-outline' as IconName, value: getSubtitle(item) },
          ];
          const status = getStatus?.(item) || item.status;

          return (
            <DataCard key={item.id || getTitle(item)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{getTitle(item)}</Text>
                  <Text style={[styles.subtle, { color: colors.textMuted }]} numberOfLines={2}>{getSubtitle(item)}</Text>
                </View>
                {status ? <StatusPill status={status} compact /> : null}
              </View>
              {details.map((detail, index) => (
                <DetailRow key={`${detail.value}-${index}`} icon={detail.icon} label={detail.label} value={detail.value} />
              ))}
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon={icon} title={emptyTitle} subtitle="Refresh the data or adjust your search." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: Spacing.sm },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3, lineHeight: 17 },
});
