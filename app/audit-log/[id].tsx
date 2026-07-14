/**
 * Audit Log Detail Screen - Full entry details with changes
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { formatEAT } from '../../utils/helpers';
import { AuditLogEntry } from '../../store/types';

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
};

export default function AuditLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [entry, setEntry] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadEntry();
  }, [id]);

  async function loadEntry() {
    try {
      // In production, fetch from AuditService
      // For now, show sample
      setEntry({
        id: id!,
        action: 'updated',
        entityType: 'purchase_order',
        entityId: 'POMAT001/V001',
        userId: 'user2',
        userName: 'Mary Manager',
        details: 'Updated quantity from 100 to 150 Tonnes',
        timestamp: new Date().toISOString(),
        severity: 'info',
        changes: {
          quantity: { from: 100, to: 150 },
        },
      });
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Entry not found</Text>
      </View>
    );
  }

  const severityColor = SEVERITY_COLORS[entry.severity] || colors.textMuted;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.severityBadge, { backgroundColor: severityColor + '15' }]}>
          <Ionicons
            name={entry.severity === 'error' ? 'alert-circle' : entry.severity === 'warning' ? 'warning' : 'information-circle'}
            size={32}
            color={severityColor}
          />
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
        </Text>
        <Badge
          label={entry.entityType.replace('_', ' ')}
          variant={entry.severity === 'error' ? 'danger' : entry.severity === 'warning' ? 'warning' : 'default'}
        />
      </View>

      {/* Details */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Entity ID</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{entry.entityId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Description</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{entry.details}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Performed By</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{entry.userName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Timestamp</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{formatEAT(entry.timestamp)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Severity</Text>
          <Badge
            label={entry.severity}
            variant={entry.severity === 'error' ? 'danger' : entry.severity === 'warning' ? 'warning' : 'default'}
            dot
          />
        </View>
      </Card>

      {/* Changes */}
      {entry.changes && Object.keys(entry.changes).length > 0 && (
        <Card style={{ marginTop: Spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Changes</Text>
          {Object.entries(entry.changes).map(([field, change]) => (
            <View key={field} style={styles.changeItem}>
              <Text style={[styles.changeField, { color: colors.text }]}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </Text>
              <View style={styles.changeValues}>
                <View style={[styles.changeValue, { backgroundColor: colors.danger + '10' }]}>
                  <Text style={[styles.changeValueText, { color: colors.danger }]}>
                    {String(change.from)}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                <View style={[styles.changeValue, { backgroundColor: colors.success + '10' }]}>
                  <Text style={[styles.changeValueText, { color: colors.success }]}>
                    {String(change.to)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Button
        title="Back to Audit Log"
        onPress={() => router.back()}
        icon="arrow-back"
        variant="secondary"
        style={{ marginTop: Spacing.lg }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  severityBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  changeItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  changeField: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changeValue: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    flex: 1,
  },
  changeValueText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
});
