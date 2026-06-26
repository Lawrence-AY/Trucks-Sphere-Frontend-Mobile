import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@truck.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, isLoading, isAuthenticated, restoreSession, clearError, error } = useAuthStore();
  const colors = useTheme();

  useEffect(() => {
    // Try to restore session on mount
    restoreSession();
  }, []);

  useEffect(() => {
    // Auto-redirect if already authenticated
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }

    setLocalError('');
    clearError();

    try {
      await login(email.trim(), password);
      // Auth store will set isAuthenticated, the effect above handles redirect
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials. Try: admin@truck.com / password');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: colors.accent }]}>
            <Ionicons name="car" size={40} color="#FFF" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>TruckSphere</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Fleet Management System
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Sign In</Text>

          {displayError ? (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(v) => { setEmail(v); setLocalError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(v) => { setPassword(v); setLocalError(''); }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.accent, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Demo: admin@truck.com / password
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  logoArea: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: Spacing.xs },
  card: {
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.xl,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: Spacing.xl },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.sm,
    marginBottom: Spacing.lg,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 48,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: 15 },
  loginBtn: {
    height: 48, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 11, textAlign: 'center', marginTop: Spacing.md },
});
