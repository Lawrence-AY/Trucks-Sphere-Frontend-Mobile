import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing } from '../constants/theme';
import { formatStatus, getStatusColor } from '../utils/helpers';

type IconName = keyof typeof Ionicons.glyphMap;

export function PageShell({
  children,
  scroll = true,
  refreshControl,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  style?: ViewStyle;
}) {
  const colors = useTheme();
  if (!scroll) {
    return <View style={[styles.shell, { backgroundColor: colors.background }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[styles.shell, { backgroundColor: colors.background }, style]}
      contentContainerStyle={styles.shellContent}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function CommandHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useTheme();
  return (
    <View style={styles.commandHeader}>
      <View style={styles.commandCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
        <Text style={[styles.commandTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.commandSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.searchField, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function FilterRail({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.filterText, { color: active ? '#06111F' : colors.textSecondary }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  tone,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  tone: string;
  onPress?: () => void;
}) {
  const colors = useTheme();
  return (
    <TouchableOpacity
      style={[styles.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.82 : 1}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const color = getStatusColor(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusPillText, { color, fontSize: compact ? 10 : 11 }]}>
        {formatStatus(status)}
      </Text>
    </View>
  );
}

export function DataCard({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const colors = useTheme();
  return (
    <TouchableOpacity
      style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.84 : 1}
    >
      {children}
    </TouchableOpacity>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function DetailRow({ icon, label, value }: { icon: IconName; label?: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
        {label ? `${label}: ` : ''}
        {value}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const colors = useTheme();
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.inputBg }]}>
      <View style={[styles.progressFill, { backgroundColor: color, width: `${clamped}%` }]} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}16` }]}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  shellContent: {
    padding: Spacing.sm,
    paddingBottom: Spacing['4xl'] + 24,
    gap: 6,
  },
  commandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  commandCopy: { flex: 1 },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  commandTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  commandSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 5,
  },
  searchField: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    fontWeight: '400',
  },
  filterRail: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '400',
  },
  metricTile: {
    flex: 1,
    minHeight: 118,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dataCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  progressTrack: {
    height: 7,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 70,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
});
