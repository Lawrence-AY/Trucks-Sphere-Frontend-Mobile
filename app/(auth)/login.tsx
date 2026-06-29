import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, isLoading, isAuthenticated, restoreSession, clearError, error } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    restoreSession();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(driftAnim, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    ).start();
  }, [driftAnim, fadeAnim, restoreSession, slideAnim]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setLocalError('Please enter your username');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }

    setLocalError('');
    clearError();

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials. Try admin / password');
    }
  };

  const truckDrift = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 12],
  });

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.panel,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>TS</Text>
            </View>
            <Text style={styles.brandName}>
              TRUCK<Text style={styles.brandAccent}>SPHERE</Text>
            </Text>
            <Text style={styles.tagline}>Operations command center</Text>
          </View>

          <Animated.View style={[styles.illustration, { transform: [{ translateX: truckDrift }] }]}>
            <Ionicons name="bus" size={46} color="#3ED9D6" />
            <View style={styles.routeLine} />
            <View style={styles.routeDot} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </Animated.View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue managing fleet operations.</Text>

          {displayError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color="#FF8A8A" />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#8EA4BA" />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#6D8196"
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setLocalError('');
                }}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#8EA4BA" />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#6D8196"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setLocalError('');
                }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword((current) => !current)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#AFC1D2" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formRow}>
            <TouchableOpacity style={styles.remember} onPress={() => setRememberMe((current) => !current)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe ? <Ionicons name="checkmark" size={13} color="#06111F" /> : null}
              </View>
              <Text style={styles.rowText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.biometricBtn} activeOpacity={0.85}>
            <Ionicons name="finger-print-outline" size={20} color="#3ED9D6" />
            <Text style={styles.biometricText}>Biometric login</Text>
          </TouchableOpacity>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Need access? Contact Admin</Text>
            <Text style={styles.metaText}>v1.0.0</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111F',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 28,
    padding: Spacing.xl,
    backgroundColor: 'rgba(12, 28, 45, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(151, 184, 212, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 14,
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#31E7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(62, 217, 214, 0.08)',
  },
  logoLetters: {
    color: '#2EA8FF',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  brandAccent: {
    color: '#2EA8FF',
  },
  tagline: {
    color: '#9DB0C4',
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  illustration: {
    height: 76,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(15, 42, 69, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(62, 217, 214, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  routeLine: {
    position: 'absolute',
    left: 42,
    right: 42,
    bottom: 18,
    height: 2,
    backgroundColor: 'rgba(46, 168, 255, 0.45)',
  },
  routeDot: {
    position: 'absolute',
    left: 38,
    bottom: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#31E7D0',
  },
  routeDotEnd: {
    left: undefined,
    right: 38,
    backgroundColor: '#2EA8FF',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#9DB0C4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.24)',
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: '#D5E2F0',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  inputWrap: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(151, 184, 212, 0.22)',
    backgroundColor: 'rgba(4, 17, 31, 0.68)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#678098',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#31E7D0',
    borderColor: '#31E7D0',
  },
  rowText: {
    color: '#D5E2F0',
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    color: '#2EA8FF',
    fontSize: 13,
    fontWeight: '800',
  },
  loginBtn: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: '#147DFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#147DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 8,
  },
  disabledBtn: {
    opacity: 0.72,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  biometricBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(62, 217, 214, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  biometricText: {
    color: '#E6F3FF',
    fontSize: 14,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  metaText: {
    color: '#91A7BC',
    fontSize: 12,
    fontWeight: '700',
  },
});
