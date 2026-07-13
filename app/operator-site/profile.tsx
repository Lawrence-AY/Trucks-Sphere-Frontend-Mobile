import { Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing } from '../../constants/theme';
import { CommandHeader, DataCard, DetailRow, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';

export default function OperatorSiteProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  return (
    <PageShell>
       <DataCard>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1B2A4A18', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#1B2A4A' }}>{(user?.displayName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'Site Operator'}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
        </View>
      </DataCard>
      <SectionTitle title="Account details" />
      <DataCard>
        <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
        <DetailRow icon="mail-outline" label="Email" value={user?.email || 'N/A'} />
        <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
        <DetailRow icon="location-outline" label="Site ID" value={user?.siteId || 'N/A'} />
      </DataCard>
    </PageShell>
  );
}