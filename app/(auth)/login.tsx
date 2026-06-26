import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@truck.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, isLoading, isAuthenticated, restoreSession, clearError, error } = useAuthStore();
  const colors = useTheme();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    restoreSession();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
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
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials. Try: admin@truck.com / password');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Decorative top gradient area */}
      <View style={styles.topSection}>
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Ionicons name="car" size={36} color="#FFF" />
          </View>
          <Text style={styles.appName}>TruckSphere</Text>
          <Text style={styles.tagline}>Fleet Management System</Text>
        </View>
      </View>

      {/* Bottom card */}
      <Animated.View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.surface,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          Sign in to continue
        </Text>

        {displayError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
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
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
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
          style={[styles.loginBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
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
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoArea: { alignItems: 'center' },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.xs,
  },
  bottomCard: {
    flex: 0.6,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['4xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  cardTitle: { fontSize: 24, fontWeight: '800' },
  cardSubtitle: { fontSize: 14, marginTop: Spacing.xs, marginBottom: Spacing['2xl'] },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: '#FEE2E2',
    marginBottom: Spacing.lg,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 50,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: 15 },
  loginBtn: {
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    shadowColor: '#1B2A4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 11, textAlign: 'center', marginTop: Spacing.md },
});
