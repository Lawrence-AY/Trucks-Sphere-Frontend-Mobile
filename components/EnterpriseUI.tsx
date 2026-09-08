import React from 'react';
import {
  ScrollView,
  StyleSheet,
  StyleProp,
  View,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  Chip,
  ProgressBar as PaperProgressBar,
  Searchbar,
  Surface,
  Text,
  TouchableRipple,
} from 'react-native-paper';
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
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  if (!scroll) {
    return <Surface style={[styles.shell, { backgroundColor: colors.background }, style]} elevation={0}>{children}</Surface>;
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
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
        {eyebrow ? <Text variant="labelMedium" style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
        <Text variant="headlineSmall" style={[styles.commandTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text variant="bodyMedium" style={[styles.commandSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
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
  return (
    <Searchbar
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      style={styles.searchField}
      inputStyle={styles.searchInput}
    />
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
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
      {options.map((option) => (
        <Chip
          key={option.key}
          selected={option.key === value}
          onPress={() => onChange(option.key)}
          showSelectedOverlay
          style={styles.filterChip}
        >
          {option.label}
        </Chip>
      ))}
    </ScrollView>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  tone,
  onPress,
  compact = false,
  emphasized = false,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  tone: string;
  onPress?: () => void;
  compact?: boolean;
  emphasized?: boolean;
}) {
  const colors = useTheme();
  return (
    <Surface
      style={[
        styles.metricTile,
        compact && styles.metricTileCompact,
        emphasized && styles.metricTileEmphasized,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      elevation={0}
    >
      <TouchableRipple onPress={onPress} disabled={!onPress} borderless style={styles.metricTouchable}>
        <View style={[styles.metricContent, compact && styles.metricContentCompact, emphasized && styles.metricContentEmphasized]}>
          <View style={[compact && styles.metricCompactTopRow, emphasized && styles.metricCompactTopRowEmphasized]}>
            <View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}>
              <Ionicons name={icon} size={20} color={tone} />
            </View>
            {compact ? <Text variant="titleMedium" style={[styles.metricCompactValue, emphasized && styles.metricCompactValueEmphasized, { color: colors.text }]}>{value}</Text> : null}
          </View>
          {!compact ? <Text variant="titleMedium" style={{ color: colors.text }}>{value}</Text> : null}
          <Text variant="bodyMedium" style={[compact && styles.metricCompactLabel, emphasized && styles.metricCompactLabelEmphasized, { color: colors.textMuted }]}>{label}</Text>
        </View>
      </TouchableRipple>
      {emphasized ? <View pointerEvents="none" style={[styles.metricAccent, { backgroundColor: tone }]} /> : null}
    </Surface>
  );
}

export function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const color = getStatusColor(status);
  return (
    <Chip
      compact={compact}
      icon="circle"
      style={[styles.statusPill, { backgroundColor: `${color}18` }]}
      textStyle={[styles.statusPillText, { color }]}
      theme={{ colors: { onSurfaceVariant: color } }}
    >
      {formatStatus(status)}
    </Chip>
  );
}

export function DataCard({
  children,
  onPress,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Card mode="outlined" onPress={onPress} disabled={!onPress} style={[styles.dataCard, style]} contentStyle={[styles.dataCardContent, contentStyle]}>
      {children}
    </Card>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function DetailRow({ icon, label, value, multiline = false }: { icon?: IconName; label?: string; value: string; multiline?: boolean }) {
  const colors = useTheme();
  return (
    <View style={styles.detailRow}>
      {icon ? <Ionicons name={icon} size={14} color={colors.textMuted} /> : null}
      <Text variant="bodyMedium" style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={multiline ? undefined : 1}>
        {label ? `${label}: ` : ''}
        {value}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const colors = useTheme();
  return <PaperProgressBar progress={Math.max(0, Math.min(value, 100)) / 100} color={color} style={[styles.progressBar, { backgroundColor: colors.inputBg }]} />;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  transparent = true,
  actionLabel,
  onAction,
  singleLineTitle = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  transparent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  singleLineTitle?: boolean;
}) {
  const colors = useTheme();
  return (
    <Surface style={[styles.empty, { backgroundColor: transparent ? 'transparent' : colors.surface }]} elevation={0}>
      <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}16` }]}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text
        variant="titleMedium"
        style={{ color: colors.text }}
        numberOfLines={singleLineTitle ? 1 : undefined}
        adjustsFontSizeToFit={singleLineTitle}
        minimumFontScale={0.8}
      >
        {title}
      </Text>
      {subtitle ? <Text variant="bodyMedium" style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableRipple
          onPress={onAction}
          borderless
          style={[styles.emptyAction, { backgroundColor: `${colors.primary}14` }]}
        >
          <Text variant="labelLarge" style={{ color: colors.primary }}>{actionLabel}</Text>
        </TouchableRipple>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 0, width: '100%', minWidth: 0 },
  shellContent: {
    paddingHorizontal: '0.7%',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing['xl'],
    gap: Spacing.xs,
  },
  commandHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  commandCopy: { flex: 1, minWidth: 0, flexBasis: '65%' },
  eyebrow: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0, marginBottom: Spacing.xs,
  },
  commandTitle: {
    fontWeight: '800',
    letterSpacing: 0,
  },
  commandSubtitle: {
    lineHeight: 18, marginTop: Spacing.xs,
  },
  searchField: {
    borderRadius: Radius.md, marginVertical: Spacing.xs,
  },
  searchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  filterRail: {
    gap: 6,
    paddingRight: Spacing.md,
  },
  filterChip: {
    minHeight: 34,
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 104,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  metricTileCompact: {
    minHeight: 80,
  },
  metricTileEmphasized: {
    borderRadius: Radius.md,
  },
  metricTouchable: {
    flex: 1,
  },
  metricContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  metricContentCompact: {
    paddingVertical: Spacing.sm,
  },
  metricContentEmphasized: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  metricCompactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metricCompactTopRowEmphasized: {
    justifyContent: 'space-between',
  },
  metricCompactValue: {
    fontWeight: '800',
  },
  metricCompactValueEmphasized: {
    fontSize: 21,
    letterSpacing: -0.3,
  },
  metricCompactLabel: {
    fontSize: 13,
  },
  metricCompactLabelEmphasized: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricAccent: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 0,
    left: Spacing.md,
    height: 3,
    borderTopLeftRadius: Radius.full,
    borderTopRightRadius: Radius.full,
  },
  statusPill: {
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dataCard: {
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: 5, marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  dataCardContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailText: {
    flex: 1,
    minWidth: 0,
  },
  progressBar: {
    height: 7,
    borderRadius: Radius.full,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAction: {
    borderRadius: Radius.md,
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});
