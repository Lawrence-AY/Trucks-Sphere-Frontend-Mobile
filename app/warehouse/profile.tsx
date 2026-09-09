import { Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing } from '../../constants/theme';
import { DataCard, DetailRow, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';
import { AccountDeletionRequest } from '../../components/AccountDeletionRequest';

export default function WarehouseProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  return (
    <PageShell>
      <DataCard>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primaryText }}>{(user?.displayName || 'W').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'Warehouse Operator'}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
        </View>
      </DataCard>
      <SectionTitle title="Account details" />
      <DataCard>
        <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
        <DetailRow icon="mail-outline" label="Email" value={user?.email || 'N/A'} />
        <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
      </DataCard>
      <AccountDeletionRequest />
    </PageShell>
  );
}
