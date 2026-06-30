import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import {
  CommandHeader,
  DataCard,
  EmptyState,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const colors = useTheme();

  return (
    <PageShell>
        
      <EmptyState
        icon="notifications-off-outline"
        title="No notifications"
        subtitle="You're all caught up. New alerts and updates will appear here."
      />
    </PageShell>
  );
}