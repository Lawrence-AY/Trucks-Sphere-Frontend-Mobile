import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

export default function SiteScreen() {
  const colors = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Site Operations</Text>
        <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Receive and manage deliveries</Text>
      </View>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push('/site/receive')}
      >
        <View style={[styles.actionIcon, { backgroundColor: '#2563EB15' }]}>
          <Ionicons name="download" size={32} color="#2563EB" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Receive Delivery</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>
            Confirm incoming materials and capture delivery note
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push('/(tabs)/dashboard')}
      >
        <View style={[styles.actionIcon, { backgroundColor: '#16A34A15' }]}>
          <Ionicons name="time" size={32} color="#16A34A" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Today's Schedule</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>
            View incoming deliveries and completed receives
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepHeader: { padding: Spacing.lg, paddingBottom: Spacing.md },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepSub: { fontSize: 13, marginTop: 4 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md,
  },
  actionIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actionInfo: { flex: 1 },
  actionLabel: { fontSize: 16, fontWeight: '700' },
  actionSub: { fontSize: 12, marginTop: 4 },
});
