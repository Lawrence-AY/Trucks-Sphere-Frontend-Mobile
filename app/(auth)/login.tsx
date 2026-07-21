//login.tsx
import { useEffect, useState } from 'react';
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
import { managementHomeRoute, normalizeRole } from '../../utils/access';

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
      const role = normalizeRole(useAuthStore.getState().user?.role);
      switch (role) {
        case 'super_admin':
        case 'management_edit':
        case 'management_lite': router.replace(managementHomeRoute(role) as any); break;
        case 'vendor': router.replace('/vendor/dashboard' as any); break;
        case 'operator_site': router.replace('/operator-site/schedule' as any); break;
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
      setLocalError(err.message || 'Invalid credentials. Please check your username and password.');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <View style={styles.brand}>
          
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
            <Text style={styles.label}>Username or Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color="#667781" />
              <TextInput
                style={styles.input}
                placeholder="Username or email"
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
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color="#667781" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(v) => { setPassword(v); setLocalError(''); }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword((c) => !c)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#667781" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, isLoading && { opacity: 0.7 }]} onPress={handleLogin} disabled={isLoading} activeOpacity={0.85}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.loginBtnText}>Login</Text>}
          </TouchableOpacity>

          <View style={{ height: 20 }} />
          <Text style={styles.version}>v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E9EDEF' },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  panel: {
    width: '100%', maxWidth: 440, alignSelf: 'center',
    borderRadius: Radius.xl, padding: Spacing['2xl'],
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#D9E1E5',
  },
  brand: { alignItems: 'center', marginBottom: Spacing.lg },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  brandName: { color: '#1F2C34', fontSize: 21, fontWeight: '800' },
  brandAccent: { color: '#229ED9' },
  tagline: { color: '#667781', marginTop: 4, fontSize: 14 },
  illustration: {
    height: 76, borderRadius: Radius.lg,
    backgroundColor: '#E8EDF5', borderWidth: 1, borderColor: '#CBD7EA',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  title: { color: '#1F2C34', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#667781', fontSize: 14, lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    marginBottom: Spacing.lg,
  },
  errorText: { color: '#DC2626', fontSize: 14, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { color: '#3B4A54', fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
  inputWrap: {
    height: 58, borderRadius: Radius.lg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, borderColor: '#D9E1E5', backgroundColor: '#F7F9FA',
  },
  input: { flex: 1, fontSize: 16, color: '#1F2C34' },
  loginBtn: {
    height: 54, borderRadius: Radius.lg, backgroundColor: '#229ED9',
    alignItems: 'center', justifyContent: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  hint: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: Spacing.lg },
 
  version: { color: '#8696A0', fontSize: 13, textAlign: 'center', marginTop: Spacing.sm },
});
