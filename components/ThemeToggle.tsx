import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme, useThemeMode } from '../hooks/useTheme';

/** A compact appearance switch designed for persistent navigation drawers. */
export function ThemeToggle() {
  const colors = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const nextModeLabel = isDark ? 'Light mode' : 'Dark mode';
  const appearanceIconColor = isDark ? colors.accent : colors.primary;
  const appearanceIconBackground = isDark ? `${colors.accent}1A` : colors.primaryLight;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${nextModeLabel.toLowerCase()}`}
      style={[styles.container, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      onPress={toggleTheme}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: appearanceIconBackground }]}>
        <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={19} color={appearanceIconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{nextModeLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    marginHorizontal: 16, marginTop: Spacing.xs,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600', marginTop: Spacing.xs,
  },
});
