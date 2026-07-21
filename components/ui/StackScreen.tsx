import React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type StackScreenProps = {
  title: string;
  subtitle?: string;
  fallbackHref: Href;
  children?: React.ReactNode;
  right?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/**
 * The common shell for every stack detail/form screen.  Back always follows
 * the real navigation history; `fallbackHref` is used only for a deep link.
 */
export function StackScreen({
  title,
  subtitle,
  fallbackHref,
  children,
  right,
  loading = false,
  error,
  onRetry,
  scroll = true,
  contentStyle,
}: StackScreenProps) {
  const colors = useTheme();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  const body = loading ? (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading…</Text>
    </View>
  ) : error ? (
    <View style={styles.state} accessibilityLiveRegion="assertive">
      <View style={[styles.errorIcon, { backgroundColor: `${colors.danger}16` }]}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <Text style={[styles.errorTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.stateText, { color: colors.textSecondary }]}>{error}</Text>
      {onRetry ? (
        <TouchableOpacity style={[styles.retry, { backgroundColor: colors.primary }]} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : children;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={[styles.backButton, { backgroundColor: colors.inputBg }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleGroup}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          {body}
        </ScrollView>
      ) : <View style={[styles.fill, contentStyle]}>{body}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, borderBottomWidth: 1 },
  backButton: { width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  titleGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] + 24 },
  state: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.md },
  stateText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  errorIcon: { width: 56, height: 56, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 17, fontWeight: '800' },
  retry: { marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, height: 42 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
