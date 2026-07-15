/**
 * Public Tracking Page
 *
 * Renders a read-only tracking dashboard for a delivery in transit.
 * This page is publicly accessible — no authentication required.
 *
 * URL format: /track/KAA123B (vehicle registration number)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fetchPublicTrackingByPlate } from '../../services/api';
import { Colors, Spacing, Radius } from '../../constants/theme';

function formatEAT(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function openMaps(lat?: number, lng?: number) {
  if (lat == null || lng == null) return;
  Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`).catch(() => {});
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'active'; data: any }
  | { kind: 'expired'; message: string }
  | { kind: 'error'; message: string };

export default function PublicTrackingScreen() {
  const { plate } = useLocalSearchParams<{ plate: string }>();
  const [searchPlate, setSearchPlate] = useState((plate || '').toUpperCase());
  const [state, setState] = useState<PageState>(
    plate ? { kind: 'loading' } : { kind: 'expired', message: 'Enter a vehicle registration number to track.' }
  );
  const [photoFullscreen, setPhotoFullscreen] = useState(false);

  const trackByPlate = useCallback(async (plateNum: string) => {
    const clean = (plateNum || '').trim().toUpperCase();
    if (!clean || clean.length < 3) {
      setState({ kind: 'expired', message: 'Enter a valid vehicle registration number (min 3 chars).' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const data = await fetchPublicTrackingByPlate(clean);
      setState({ kind: 'active', data });
    } catch (err: any) {
      setState({ kind: 'expired', message: err?.message || 'This tracking link has expired or is no longer active.' });
    }
  }, []);

  useEffect(() => {
    if (plate) {
      const p = String(plate).toUpperCase();
      setSearchPlate(p);
      trackByPlate(p);
    }
  }, [plate, trackByPlate]);

  // Auto-refresh tracking data every 10 seconds when showing active delivery
  useEffect(() => {
    if (state.kind !== 'active') return;
    const interval = setInterval(() => {
      if (searchPlate && searchPlate.length >= 3) {
        trackByPlate(searchPlate);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [state.kind, searchPlate, trackByPlate]);

  const colors = Colors.light;
  const bg = colors.background;
  const surface = colors.surface;
  const text = colors.text;
  const textSec = colors.textSecondary;
  const textMut = colors.textMuted;
  const border = colors.border;
  const primary = colors.primary;

  function renderSearchBar() {
    return (
      <View style={[styles.searchBar, { backgroundColor: '#F8FAFC', borderColor: border }]}>
        <Ionicons name="search" size={18} color={textMut} />
        <TextInput
          style={[styles.searchInput, { color: text }]}
          placeholder="Enter plate number (e.g. KAA 123B)"
          placeholderTextColor={textMut}
          value={searchPlate}
          onChangeText={setSearchPlate}
          onSubmitEditing={() => trackByPlate(searchPlate)}
          returnKeyType="search"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => trackByPlate(searchPlate)}
          disabled={!searchPlate || searchPlate.length < 3}
          style={{ opacity: searchPlate && searchPlate.length >= 3 ? 1 : 0.3 }}
        >
          <Ionicons name="arrow-forward-circle" size={24} color={primary} />
        </TouchableOpacity>
      </View>
    );
  }

  /* ─── Header shared by all states ─── */
  const renderHeader = (subtitle: string, showLiveBadge?: boolean) => (
    <View style={[styles.header, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerLeftGroup}>
          <View style={[styles.headerIconCircle, { backgroundColor: primary + '14' }]}>
            <Ionicons name="location-outline" size={22} color={primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: text }]}>Delivery Tracking</Text>
            <Text style={[styles.headerSubtitle, { color: textMut }]}>{subtitle}</Text>
          </View>
        </View>
        {showLiveBadge && (
          <View style={[styles.liveBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
        )}
      </View>
      {renderSearchBar()}
    </View>
  );

  /* ─── Expired / Error State ─── */
  if (state.kind === 'expired' || state.kind === 'error') {
    return (
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {renderHeader('Enter plate number')}
          <View style={styles.centerContent}>
            <View style={styles.expiredCard}>
              <View style={[styles.expiredIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="time-outline" size={48} color="#EF4444" />
              </View>
              <Text style={[styles.expiredTitle, { color: text }]}>Tracking Expired</Text>
              <Text style={[styles.expiredMessage, { color: textSec }]}>{state.message}</Text>
              <View style={[styles.expiredDivider, { backgroundColor: border }]} />
              <Text style={[styles.expiredHint, { color: textMut }]}>
                Tracking links are only active while the delivery is in transit.
                Once the truck arrives at the destination site, the link is
                automatically deactivated for privacy and security.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ─── Loading State ─── */
  if (state.kind === 'loading') {
    return (
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {renderHeader('Loading...')}
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.loadingText, { color: textMut }]}>Loading tracking data...</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ─── Active Tracking Dashboard ─── */
  const d = state.data;
  const quarryWeighIn = d.weighInWeight ?? d.quarryWeighInWeight;
  const quarryWeighOut = d.weighOutWeight ?? d.quarryWeighOutWeight;
  const quarryNet = d.netWeight ?? (quarryWeighIn != null && quarryWeighOut != null ? quarryWeighIn - quarryWeighOut : null);
  const siteWeighIn = d.siteWeighInWeight;
  const siteWeighOut = d.siteWeighOutWeight;
  const siteNet = (siteWeighIn != null && siteWeighOut != null) ? siteWeighIn - siteWeighOut : null;
  const hasQuarryWeights = quarryWeighIn != null || quarryWeighOut != null || quarryNet != null;
  const hasSiteWeights = siteWeighIn != null || siteWeighOut != null;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderHeader(d.plateNumber || '—', true)}

        {/* ─── Source Quarry Card (includes quarry weight records) ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="map-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.cardTitle, { color: text }]}>Source Quarry</Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: border }]} />
          
          {d.weighOutGeoLocation?.address ? (
            <InfoRow label="City / Town" value={d.weighOutGeoLocation.address} colors={colors} />
          ) : d.weighOutLocation ? (
            <InfoRow label="Location" value={d.weighOutLocation} colors={colors} />
          ) : null}
          {d.materialSource ? <InfoRow label="Material Source" value={d.materialSource} colors={colors} /> : null}
          {hasQuarryWeights ? (
            <>
              <View style={[styles.weightDivider, { backgroundColor: border }]} />
              <Text style={[styles.sectionLabel, { color: textSec }]}>Weigh Records</Text>
            </>
          ) : null}
          {quarryWeighIn != null ? <InfoRow label="Weigh In (Tare)" value={`${quarryWeighIn.toFixed(1)} tonnes`} colors={colors} /> : null}
          {quarryWeighOut != null ? <InfoRow label="Weigh Out (Gross)" value={`${quarryWeighOut.toFixed(1)} tonnes`} colors={colors} /> : null}
          {quarryNet != null ? <InfoRow label="Net Weight" value={`${quarryNet.toFixed(1)} tonnes`} colors={colors} valueColor={colors.success} /> : null}
          <View style={[styles.weightDivider, { backgroundColor: border }]} />
          <InfoRow label="Dispatched At" value={formatEAT(d.weighOutAt || d.dispatchedAt)} colors={colors} />
        </View>

        {/* ─── Cargo Details Card (includes driver National ID) ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIcon, { backgroundColor: primary + '0F' }]}>
              <Ionicons name="document-text-outline" size={18} color={primary} />
            </View>
            <Text style={[styles.cardTitle, { color: text }]}>Cargo Details</Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: border }]} />
          <InfoRow label="Material" value={d.materialName || '—'} colors={colors} />
          <InfoRow label="Truck (Plate)" value={d.plateNumber || '—'} colors={colors} />
          <InfoRow label="Driver" value={d.driverName || '—'} colors={colors} />
          {d.driverNationalId ? <InfoRow label="National ID" value={d.driverNationalId} colors={colors} /> : null}
        </View>

        {/* ─── Site Weights Card (only appears when site weigh data is present) ─── */}
        {hasSiteWeights ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardHeadIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="scale-outline" size={18} color="#10B981" />
              </View>
              <Text style={[styles.cardTitle, { color: text }]}>Site Weights</Text>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: border }]} />
            <Text style={[styles.sectionLabel, { color: textSec }]}>Destination Site</Text>
            {siteWeighIn != null ? <InfoRow label="Arrival Weight" value={`${siteWeighIn.toFixed(1)} tonnes`} colors={colors} /> : null}
            {siteWeighOut != null ? <InfoRow label="Offload Weight" value={`${siteWeighOut.toFixed(1)} tonnes`} colors={colors} /> : null}
            {siteNet != null ? <InfoRow label="Net Weight (Site)" value={`${siteNet.toFixed(1)} tonnes`} colors={colors} valueColor={colors.success} /> : null}
            {quarryNet != null && siteNet != null ? (
              <>
                <View style={[styles.weightDivider, { backgroundColor: border }]} />
                <View style={[styles.totalWeightRow, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.totalWeightLabel, { color: '#047857' }]}>Combined Net</Text>
                  <Text style={[styles.totalWeightValue, { color: '#047857' }]}>{(quarryNet + siteNet).toFixed(1)} tonnes</Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* ─── Dispatch Proof Card ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.cardTitle, { color: text }]}>Dispatch Proof</Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: border }]} />
          {d.driverPhotoURL ? (
            <View style={styles.photoSection}>
              <View style={styles.photoHeader}>
                <Ionicons name="camera-outline" size={16} color={textSec} />
                <Text style={[styles.photoLabel, { color: textSec }]}>Driver Verification Photo</Text>
              </View>
              <TouchableOpacity activeOpacity={0.9} onPress={() => setPhotoFullscreen(true)} style={styles.photoContainer}>
                <Image source={{ uri: d.driverPhotoURL }} style={[styles.driverPhoto, { borderColor: border }]} resizeMode="contain" />
                <View style={styles.photoOverlay}>
                  <Ionicons name="expand-outline" size={22} color="#fff" />
                  <Text style={styles.photoOverlayText}>Tap to expand</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}
          {d.weighOutCoordinates ? (
            <TouchableOpacity
              style={[styles.coordRow, { borderColor: colors.warning + '33', backgroundColor: '#FFFBEB' }]}
              activeOpacity={0.7}
              onPress={() => openMaps(d.weighOutCoordinates?.latitude, d.weighOutCoordinates?.longitude)}
            >
              <View style={[styles.coordIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="location" size={16} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coordTitle, { color: text }]}>Quarry Dispatch Location</Text>
                <Text style={[styles.coordValue, { color: textSec }]}>
                  {d.weighOutCoordinates.latitude?.toFixed(6)}, {d.weighOutCoordinates.longitude?.toFixed(6)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={textMut} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Ionicons name="lock-closed-outline" size={14} color={textMut} />
          <Text style={[styles.footerText, { color: textMut }]}>This tracking link will automatically expire upon delivery.</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={photoFullscreen} transparent animationType="fade" onRequestClose={() => setPhotoFullscreen(false)}>
        <Pressable style={styles.fullscreenOverlay} onPress={() => setPhotoFullscreen(false)}>
          <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={() => setPhotoFullscreen(false)} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {d.driverPhotoURL ? <Image source={{ uri: d.driverPhotoURL }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
          <Text style={styles.fullscreenCaption}>Driver Verification Photo</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value, colors, valueColor }: { label: string; value: string; colors: typeof Colors.light; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor || colors.text }]} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['4xl'] },

  /* ─── Header ─── */
  header: {
    paddingTop: Platform.OS === 'web' ? 32 : 56,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 1, letterSpacing: 0.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#10B981', textTransform: 'uppercase' },

  /* ─── Search Bar ─── */
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 4 },

  /* ─── Center Content ─── */
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: Spacing['2xl'] },

  /* ─── Cards ─── */
  card: {
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    ...Platform.select({ web: { boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }, default: { elevation: 2 } }),
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardHeadIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDivider: { height: 1, marginVertical: Spacing.xs },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, gap: Spacing.sm },
  infoLabel: { fontSize: 13, fontWeight: '500', flexShrink: 0, minWidth: 110 },
  infoValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.xs, marginBottom: 2 },
  weightDivider: { height: 1, marginVertical: Spacing.sm },
  totalWeightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.xs },
  totalWeightLabel: { fontSize: 14, fontWeight: '800' },
  totalWeightValue: { fontSize: 16, fontWeight: '900' },

  photoSection: { marginTop: Spacing.md, gap: Spacing.sm },
  photoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoLabel: { fontSize: 12, fontWeight: '600' },
  photoContainer: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden' as const, backgroundColor: '#F8FAFC' },
  driverPhoto: { width: '100%', height: Platform.OS === 'web' ? 400 : 280, borderWidth: 1, borderRadius: Radius.md, backgroundColor: '#F1F5F9' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  photoOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  fullscreenCloseBtn: { position: 'absolute', top: Platform.OS === 'web' ? 24 : 56, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '70%', borderRadius: Radius.md },
  fullscreenCaption: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: Spacing.lg },

  coordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, borderWidth: 1 },
  coordIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coordTitle: { fontSize: 12, fontWeight: '700' },
  coordValue: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  expiredCard: { alignItems: 'center', maxWidth: 320, gap: Spacing.md },
  expiredIconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  expiredTitle: { fontSize: 20, fontWeight: '800' },
  expiredMessage: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  expiredDivider: { width: 48, height: 3, borderRadius: 2, marginVertical: Spacing.xs },
  expiredHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  loadingText: { marginTop: Spacing.md, fontSize: 14, fontWeight: '500' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  footerText: { fontSize: 11, fontWeight: '500' },
});