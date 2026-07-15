/**
 * Public Tracking Lookup Page
 *
 * Allows users to key in a vehicle registration number and navigate to the live tracking page.
 * URL format: /track?plate=KAA123B → /track/KAA123B
 */

import { useState, useRef } from 'react';
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

export default function TrackIndexScreen() {
  const [plateNumber, setPlateNumber] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const colors = Colors.light;
  const isWeb = Platform.OS === 'web';

  const handleLookup = () => {
    const plate = plateNumber.trim().toUpperCase();
    if (!plate) {
      setError('Please enter a vehicle registration number.');
      return;
    }
    if (plate.length < 3) {
      setError('Invalid plate number. Please enter a valid registration number.');
      return;
    }
    setError('');
    Keyboard.dismiss();
    router.push(`/track/${encodeURIComponent(plate)}`);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

      <View style={styles.content}>
        {/* Branding */}
        <View style={styles.branding}>
          <View style={[styles.brandIconCircle, { backgroundColor: colors.primary + '14' }]}>
            <Ionicons name="radio" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>
            TruckSphere Track
          </Text>
          <Text style={[styles.brandSub, { color: colors.textMuted }]}>
            Enter a vehicle registration number to track a delivery in real time.
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Vehicle Registration Number
          </Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surface,
                borderColor: error ? '#EF4444' : colors.border,
              },
            ]}
          >
            <Ionicons
              name="car-outline"
              size={20}
              color={error ? '#EF4444' : colors.textMuted}
            />
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  color: colors.text,
                },
              ]}
              placeholder="e.g. KAA 123B"
              placeholderTextColor={colors.textTertiary}
              value={plateNumber}
              onChangeText={(text) => {
                setPlateNumber(text.toUpperCase());
                if (error) setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={15}
              returnKeyType="go"
              onSubmitEditing={handleLookup}
              autoFocus={isWeb}
            />
            {plateNumber.length > 0 && (
              <TouchableOpacity
                onPress={() => { setPlateNumber(''); setError(''); }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {error ? (
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.lookupBtn,
              {
                backgroundColor: plateNumber.trim() ? colors.primary : colors.border,
              },
            ]}
            onPress={handleLookup}
            activeOpacity={0.8}
            disabled={!plateNumber.trim()}
          >
            <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
            <Text style={styles.lookupBtnText}>Track Delivery</Text>
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
    justifyContent: 'center',
    marginBottom: Spacing.xs,
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
    fontWeight: '600',
    marginTop: 2,
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.lg,
    marginTop: Spacing.xs,
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