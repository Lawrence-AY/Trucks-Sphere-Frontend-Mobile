import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  MetricTile,
  PageShell,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function ProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const name = user?.displayName || 'TruckSphere User';
  const completion = [user?.displayName, user?.email, user?.phone, user?.role].filter(Boolean).length * 25;

  return (
    <PageShell>
      <CommandHeader eyebrow="Internal account" title="Profile" subtitle="Manage identity, security, and operational preferences." />

      <DataCard>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
            <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email || 'No email recorded'}</Text>
          </View>
          <StatusPill status="active" compact />
        </View>
      </DataCard>

      <View style={styles.metricRow}>
        <MetricTile icon="shield-checkmark" label="Role" value={getRoleLabel(user?.role || 'management')} tone={colors.primary} />
        <MetricTile icon="key" label="Session" value="Secure" tone={colors.success} />
      </View>

      <SectionTitle title="Personal information" />
      <DataCard>
        <DetailRow icon="person-outline" label="Full name" value={name} />
        <DetailRow icon="at-outline" label="Username" value={(user?.email || 'user').split('@')[0]} />
        <DetailRow icon="mail-outline" label="Email" value={user?.email || 'Not recorded'} />
        <DetailRow icon="call-outline" label="Phone" value={user?.phone || 'Not recorded'} />
        <DetailRow icon="briefcase-outline" label="Position" value={getRoleLabel(user?.role || 'management')} />
      </DataCard>

      <SectionTitle title="Security and preferences" />
      <DataCard>
        <View style={styles.settingRow}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Password management</Text>
            <Text style={[styles.settingText, { color: colors.textMuted }]}>Change password and revoke old sessions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.settingRow}>
          <Ionicons name="notifications-outline" size={20} color={colors.accent} />
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Operations alerts</Text>
            <Text style={[styles.settingText, { color: colors.textMuted }]}>Dispatch, receipt, compliance, and weight flags</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.settingRow}>
          <Ionicons name="finger-print-outline" size={20} color={colors.success} />
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Biometric login</Text>
            <Text style={[styles.settingText, { color: colors.textMuted }]}>Ready for device-secure sign in</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </DataCard>

      <SectionTitle title="App" />
      <DataCard>
        <DetailRow icon="information-circle-outline" label="Version" value="1.0.0" />
        <DetailRow icon="server-outline" label="Mode" value="Standalone V1" />
      </DataCard>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '900' },
  identityCopy: { flex: 1 },
  name: { fontSize: 20, fontWeight: '900' },
  email: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressLabel: { fontSize: 12, fontWeight: '800' },
  progressValue: { fontSize: 12, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '900' },
  settingText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
