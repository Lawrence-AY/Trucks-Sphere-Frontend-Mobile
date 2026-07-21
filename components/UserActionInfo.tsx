import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Radius, Spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatEAT } from '../utils/helpers';

export type ResponsibleUser = {
  uid?: string;
  username?: string;
  displayName?: string;
  email?: string;
  role?: string;
  entityId?: string;
  entityType?: string;
};

type RecordWithActor = {
  createdBy?: ResponsibleUser | string | null;
  updatedBy?: ResponsibleUser | string | null;
  createdByUsername?: string;
  createdByDisplayName?: string;
  updatedByUsername?: string;
  updatedByDisplayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

function actorFrom(record: RecordWithActor, kind: 'created' | 'updated'): ResponsibleUser | null {
  const raw = kind === 'created' ? record.createdBy : record.updatedBy;
  if (raw && typeof raw === 'object') return raw;
  const name = kind === 'created' ? record.createdByDisplayName : record.updatedByDisplayName;
  const username = kind === 'created' ? record.createdByUsername : record.updatedByUsername;
  if (name || username || raw) return { displayName: name || (typeof raw === 'string' ? raw : ''), username };
  return null;
}

function labelRole(role?: string) {
  return (role || 'System').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function ActorLine({ label, actor, timestamp }: { label: string; actor: ResponsibleUser; timestamp?: string }) {
  const colors = useTheme();
  const name = actor.displayName || actor.username || actor.email || 'System';
  const initial = name.trim().charAt(0).toUpperCase() || 'S';
  const context = [labelRole(actor.role), actor.entityType ? actor.entityId || actor.entityType : ''].filter(Boolean).join(' · ');
  return (
    <View style={styles.actorLine}>
      <View style={[styles.avatar, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.initial, { color: colors.primary }]}>{initial}</Text></View>
      <View style={styles.actorCopy}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {actor.username ? `@${actor.username} · ` : ''}{context}
        </Text>
        {timestamp ? <Text style={[styles.time, { color: colors.textMuted }]}>{formatEAT(timestamp)}</Text> : null}
      </View>
    </View>
  );
}

/** Shows human-readable accountability without exposing internal user IDs. */
export function UserActionInfo({ record, title = 'Activity' }: { record: RecordWithActor; title?: string }) {
  const colors = useTheme();
  const created = actorFrom(record, 'created');
  const updated = actorFrom(record, 'updated');
  if (!created && !updated) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.heading}><Ionicons name="person-circle-outline" size={19} color={colors.primary} /><Text style={[styles.headingText, { color: colors.text }]}>{title}</Text></View>
      {created ? <ActorLine label="Created by" actor={created} timestamp={record.createdAt} /> : null}
      {updated && (!created || JSON.stringify(updated) !== JSON.stringify(created) || record.updatedAt !== record.createdAt) ? (
        <ActorLine label="Last updated by" actor={updated} timestamp={record.updatedAt} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headingText: { fontSize: 15, fontWeight: '800' },
  actorLine: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 16, fontWeight: '800' },
  actorCopy: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: .4 },
  name: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  meta: { fontSize: 12, marginTop: 1 },
  time: { fontSize: 11, marginTop: 2 },
});
