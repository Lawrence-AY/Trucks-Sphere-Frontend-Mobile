/**
 * Public Tracking Lookup Page
 *
 * Allows users to key in a vehicle registration number and navigate to the live tracking page.
 * URL format: /track?plate=KAA123B → /track/KAA123B
 */

import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { canControlStatusBarAppearance } from '../../utils/statusBar';
import { selectSecurityTrackingVehicle, startSecurityTrackingSession } from '../../services/api';
import { getItem, setItem } from '../../services/database';

const TRACK_SESSION_KEY = 'user_track';
const LEGACY_TRACK_SESSION_KEY = 'track_session';

export function TrackingSessionScreen() {
  const [error, setError] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [starting, setStarting] = useState(false);

  const colors = Colors.light;
  const isWeb = Platform.OS === 'web';

  const handleLookup = async () => {
    if (!/^[A-Z0-9]{5}$/.test(securityCode.trim())) {
      setError('Enter the 5-character security code to continue.');
      return;
    }
    setError('');
    Keyboard.dismiss();
    setStarting(true);
    try {
      const session = await startSecurityTrackingSession(securityCode.trim());
      const storedSession = JSON.stringify({ id: session.id, token: session.token, personnelName: session.personnelName });
      await Promise.all([setItem(TRACK_SESSION_KEY, storedSession), setItem(LEGACY_TRACK_SESSION_KEY, storedSession)]);
      router.replace('/track' as any);
    } catch (err: any) { setError(err?.response?.data?.error || 'The security code could not be verified.'); }
    finally { setStarting(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {canControlStatusBarAppearance ? <StatusBar style="dark" /> : null}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

      <View style={styles.content}>
        {/* Branding */}
        <View style={styles.branding}>
          <View style={[styles.brandIconCircle, { backgroundColor: colors.primary + '14' }]}>
            <Ionicons name="radio" size={40} color={colors.primaryText} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>
            TruckSphere Track
          </Text>
          <Text style={[styles.brandSub, { color: colors.textMuted }]}>
            Enter your security code to begin a tracking session.
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Security Code</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: error ? '#EF4444' : colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
            <TextInput style={[styles.input, { color: colors.text }]} placeholder="ABCDE" placeholderTextColor={colors.textTertiary} value={securityCode} onChangeText={(text) => { setSecurityCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '')); if (error) setError(''); }} autoCapitalize="characters" maxLength={5} autoFocus={isWeb} />
          </View>
          {error ? <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.lookupBtn,
              {
                backgroundColor: securityCode.length === 5 ? colors.primary : colors.border,
              },
            ]}
            onPress={handleLookup}
            activeOpacity={0.8}
            disabled={securityCode.length !== 5 || starting}
          >
            <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
            <Text style={styles.lookupBtnText}>{starting ? 'Verifying...' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>

        
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    gap: 32,
  },

  /* ─── Branding ─── */
  branding: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ─── Input ─── */
  inputSection: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    height: 56,
    gap: Spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 2,
    height: '100%',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600', marginTop: Spacing.xs,
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.lg, marginTop: Spacing.xs,
  },
  lookupBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* ─── Hint ─── */
  hintSection: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  hintDivider: {
    width: 48,
    height: 2,
    borderRadius: 1,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
});

/** `/track` accepts a vehicle registration only after security verification. */
export default function TrackIndexRedirect() {
  const [session, setSession] = useState<{ id: string; token: string } | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const colors = Colors.light;

  useEffect(() => {
    void (async () => {
      try {
        const raw = await getItem(TRACK_SESSION_KEY) || await getItem(LEGACY_TRACK_SESSION_KEY);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored?.id && stored?.token) return setSession(stored);
      } catch {
        // Invalid persisted data is equivalent to no session.
      }
      router.replace('/session' as any);
    })();
  }, []);

  const continueToTracking = async () => {
    const plate = plateNumber.trim().toUpperCase();
    if (plate.length < 3) {
      setError('Enter a valid vehicle registration number.');
      return;
    }
    if (!session) return router.replace('/session' as any);
    setSubmitting(true);
    setError('');
    try {
      await selectSecurityTrackingVehicle(session.id, session.token, plate);
      const storedSession = JSON.stringify({ ...session, plate });
      await Promise.all([setItem(TRACK_SESSION_KEY, storedSession), setItem(LEGACY_TRACK_SESSION_KEY, storedSession)]);
      router.replace(`/track/${encodeURIComponent(plate)}` as any);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to start tracking for this vehicle.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return <View style={styles.root} />;
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {canControlStatusBarAppearance ? <StatusBar style="dark" /> : null}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.branding}>
            <View style={[styles.brandIconCircle, { backgroundColor: colors.primary + '14' }]}><Ionicons name="car-outline" size={40} color={colors.primaryText} /></View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>TruckSphere Track</Text>
            <Text style={[styles.brandSub, { color: colors.textMuted }]}>Enter the vehicle registration number to track its active delivery.</Text>
          </View>
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Vehicle Registration Number</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: error ? '#EF4444' : colors.border }]}>
              <Ionicons name="car-outline" size={20} color={colors.textMuted} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="e.g. KAA 123B" placeholderTextColor={colors.textTertiary} value={plateNumber} onChangeText={(value) => { setPlateNumber(value.toUpperCase()); setError(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={15} returnKeyType="go" onSubmitEditing={continueToTracking} autoFocus />
            </View>
            {error ? <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text> : null}
            <TouchableOpacity style={[styles.lookupBtn, { backgroundColor: plateNumber.trim() ? colors.primary : colors.border }]} onPress={continueToTracking} activeOpacity={0.8} disabled={!plateNumber.trim() || submitting}>
              <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
              <Text style={styles.lookupBtnText}>{submitting ? 'Starting...' : 'Track Delivery'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
