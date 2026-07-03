//login.tsx
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Radius, Spacing } from '../../constants/theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, isLoading, isAuthenticated, restoreSession, clearError, error } = useAuthStore();

  useEffect(() => {
    // Skip restore to prevent stale session from affecting login
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const role = useAuthStore.getState().user?.role || '';
      switch (role) {
        case 'management':
        case 'admin': router.replace('/management/dashboard' as any); break;
        case 'vendor': router.replace('/vendor/dashboard' as any); break;
        case 'operator_site': router.replace('/operator-site/dashboard' as any); break;
         case 'operator_quarry': router.replace('/operator-quarry/dashboard' as any); break;
         case 'operator_fuel': router.replace('/operator-fuel/dispense' as any); break;
         default: router.replace('/management/dashboard' as any);
      }
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
      setLocalError(err.message || 'Invalid credentials. Try admin / password');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>TS</Text>
            </View>
            <Text style={styles.brandName}>TRUCK<Text style={styles.brandAccent}>SPHERE</Text></Text>
            <Text style={styles.tagline}>Fleet operations</Text>
          </View>

          <View style={styles.illustration}>
            <Ionicons name="bus" size={40} color="#1B2A4A" />
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue managing fleet operations.</Text>

          {displayError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color="#EF4444" />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputWrap, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <TextInput
                style={[styles.input, { color: '#1E293B' }]}
                placeholder="Username"
                placeholderTextColor="#94A3B8"
                value={username}
                onChangeText={(v) => { setUsername(v); setLocalError(''); }}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <TextInput
                style={[styles.input, { color: '#1E293B' }]}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(v) => { setPassword(v); setLocalError(''); }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword((c) => !c)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, isLoading && { opacity: 0.7 }]} onPress={handleLogin} disabled={isLoading} activeOpacity={0.85}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.loginBtnText}>Login</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>Login with one of the test accounts:</Text>
         
          <View style={{ height: 16 }} />
          <Text style={styles.version}>v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  panel: {
    width: '100%', maxWidth: 440, alignSelf: 'center',
    borderRadius: 20, padding: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  brand: { alignItems: 'center', marginBottom: Spacing.lg },
  logoMark: {
    width: 56, height: 56, borderRadius: 16,
    borderWidth: 2, borderColor: '#1B2A4A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    backgroundColor: '#1B2A4A10',
  },
  logoLetters: { color: '#1B2A4A', fontSize: 22, fontWeight: '700' },
  brandName: { color: '#1E293B', fontSize: 20, fontWeight: '700' },
  brandAccent: { color: '#1B2A4A' },
  tagline: { color: '#94A3B8', marginTop: 4, fontSize: 14 },
  illustration: {
    height: 64, borderRadius: Radius.lg,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  title: { color: '#1E293B', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#64748B', fontSize: 14, lineHeight: 19, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    marginBottom: Spacing.lg,
  },
  errorText: { color: '#DC2626', fontSize: 14, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { color: '#475569', fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrap: {
    height: 48, borderRadius: Radius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, fontSize: 14 },
  loginBtn: {
    height: 48, borderRadius: Radius.md, backgroundColor: '#1B2A4A',
    alignItems: 'center', justifyContent: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  hint: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: Spacing.lg },
 
  version: { color: '#CBD5E1', fontSize: 14, textAlign: 'center', marginTop: Spacing.sm },
});