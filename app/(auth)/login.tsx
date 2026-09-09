import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme, useThemeMode } from '../../hooks/useTheme';
import { isManagementRole, managementHomeRoute, normalizeRole } from '../../utils/access';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, isLoading, isAuthenticated, clearError, error } = useAuthStore();
  const colors = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const appearanceIconColor = isDark ? colors.accent : colors.primary;
  const appearanceIconBackground = isDark ? `${colors.accent}1A` : colors.primaryLight;

  useEffect(() => {
    if (!isAuthenticated) return;
    const role = normalizeRole(useAuthStore.getState().user?.role);
    if (isManagementRole(role)) {
      router.replace(managementHomeRoute(role) as any);
      return;
    }
    switch (role) {
      case 'vendor': router.replace('/vendor/dashboard' as any); break;
      case 'operator_site': router.replace('/operator-site/schedule' as any); break;
      case 'operator_quarry': router.replace('/operator-quarry/dashboard' as any); break;
      case 'operator_fuel': router.replace('/operator-fuel/dispense' as any); break;
      case 'operator_warehouse': router.replace('/warehouse' as any); break;
      default: router.replace('/management/dashboard' as any);
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!username.trim()) { setLocalError('Please enter your username'); return; }
    if (!password.trim()) { setLocalError('Please enter your password'); return; }
    setLocalError('');
    clearError();
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials. Please check your username and password.');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card mode="outlined" style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]} contentStyle={styles.panelContent}>
         
          <View style={styles.brand}>
            <Text variant="titleLarge" style={[styles.brandName, { color: colors.text }]}>TRUCK<Text style={[styles.brandAccent, { color: colors.primaryText }]}>SPHERE</Text></Text>
            <Text variant="bodyMedium" style={[styles.tagline, { color: colors.textSecondary }]}>Fleet operations</Text>
          </View>

          <View style={[styles.illustration, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="bus" size={40} color={isDark ? colors.text : colors.primary} />
          </View>

          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>Welcome back</Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to continue managing fleet operations.</Text>

          {displayError ? <HelperText type="error" visible style={styles.error}>{displayError}</HelperText> : null}

          <TextInput
            mode="outlined"
            label="Username"
            value={username}
            onChangeText={(value) => { setUsername(value); setLocalError(''); }}
            autoCapitalize="none"
            disabled={isLoading}
            left={<TextInput.Icon icon={({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />} />}
            style={[styles.input, { backgroundColor: colors.surface }]}
            outlineColor={colors.border}
            activeOutlineColor={isDark ? colors.accent : colors.primary}
            textColor={colors.text}
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={(value) => { setPassword(value); setLocalError(''); }}
            secureTextEntry={!showPassword}
            disabled={isLoading}
            left={<TextInput.Icon icon={({ color, size }) => <Ionicons name="lock-closed-outline" color={color} size={size} />} />}
            right={<TextInput.Icon icon={({ color, size }) => <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} color={color} size={size} />} onPress={() => setShowPassword((current) => !current)} forceTextInputFocus={false} />}
            style={[styles.input, { backgroundColor: colors.surface }]}
            outlineColor={colors.border}
            activeOutlineColor={isDark ? colors.accent : colors.primary}
            textColor={colors.text}
          />

          <Button mode="contained" buttonColor={colors.primary} onPress={handleLogin} loading={isLoading} disabled={isLoading} style={styles.loginButton} contentStyle={styles.loginButtonContent} labelStyle={styles.loginButtonLabel}>
            Login
          </Button>

          <Text variant="labelSmall" style={[styles.version, { color: colors.textMuted }]}>v1.0.0</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  panel: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: Radius.xl },
  panelContent: { padding: Spacing['2xl'] },
  appearanceButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    paddingRight: 10, marginBottom: Spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  appearanceIcon: {
    width: 20,
    height: 20,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceLabel: { fontSize: 10, fontWeight: '700' },
  brand: { alignItems: 'center', marginBottom: Spacing.xs},
  brandName: { fontWeight: '800' },
  brandAccent: {},
  tagline: { marginTop: Spacing.xs},
  illustration: { height: 76, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs},
  title: { fontWeight: '800',fontSize: 18},
  subtitle: { lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.xs,fontSize: 12 },
  error: { marginBottom: Spacing.xs},
  input: { marginBottom: Spacing.xs},
  loginButton: { marginTop: Spacing.xs},
  loginButtonContent: { height: 52 },
  loginButtonLabel: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', marginTop: Spacing.xs},
});
