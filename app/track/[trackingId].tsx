/**
 * Public Tracking Page
 *
 * Renders a read-only tracking dashboard for a delivery in transit.
 * This page is publicly accessible — no authentication required.
 *
 * URL format: /track/SA-XXXXXXX
 *
 * States handled:
 *   - Loading (fetching data)
 *   - Active (in-transit delivery with full tracking details)
 *   - Expired (404 — link no longer valid)
 *   - Error (network or unexpected error)
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fetchPublicTracking } from '../../services/api';
import { Colors, Spacing, Radius } from '../../constants/theme';

/* ─── Helpers ─── */

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

function openMaps(lat?: number, lng?: number, label?: string) {
  if (lat == null || lng == null) return;
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

/* ─── Constants ─── */

type PageState =
  | { kind: 'loading' }
  | { kind: 'active'; data: any }
  | { kind: 'expired'; message: string }
  | { kind: 'error'; message: string };

const TRACKING_ID_REGEX = /^SA-[0-9A-Z]{7}$/;

/* ─── Component ─── */

export default function PublicTrackingScreen() {
  const { trackingId } = useLocalSearchParams<{ trackingId: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Validate format client-side before making the request
      const id = (trackingId || '').trim().toUpperCase();
      if (!TRACKING_ID_REGEX.test(id)) {
        if (!cancelled) {
          setState({
            kind: 'expired',
            message: 'This tracking link is invalid or has expired.',
          });
        }
        return;
      }

      try {
        const data = await fetchPublicTracking(id);
        if (!cancelled) {
          setState({ kind: 'active', data });
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg =
            err?.message ||
            'This tracking link has expired or is no longer active.';
          setState({ kind: 'expired', message: msg });
        }
      }
    }

    setState({ kind: 'loading' });
    load();

    return () => {
      cancelled = true;
    };
  }, [trackingId]);

  const colors = Colors.light;
  const bg = colors.background;
  const surface = colors.surface;
  const text = colors.text;
  const textSec = colors.textSecondary;
  const textMut = colors.textMuted;
  const border = colors.border;
  const primary = colors.primary;

  /* ─── Expired / Error State ─── */

  if (state.kind === 'expired' || state.kind === 'error') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: bg }]}>
        <StatusBar style="dark" />
        <View style={styles.expiredCard}>
          <View style={[styles.expiredIconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="time-outline" size={48} color="#EF4444" />
          </View>
          <Text style={[styles.expiredTitle, { color: text }]}>
            Tracking Expired
          </Text>
          <Text style={[styles.expiredMessage, { color: textSec }]}>
            {state.message}
          </Text>
          <View style={[styles.expiredDivider, { backgroundColor: border }]} />
          <Text style={[styles.expiredHint, { color: textMut }]}>
            Tracking links are only active while the delivery is in transit.
            Once the truck arrives at the destination site, the link is
            automatically deactivated for privacy and security.
          </Text>
        </View>
      </View>
    );
  }

  /* ─── Loading State ─── */

  if (state.kind === 'loading') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: bg }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={primary} />
        <Text style={[styles.loadingText, { color: textMut }]}>
          Loading tracking data...
        </Text>
      </View>
    );
  }

  /* ─── Active Tracking Dashboard ─── */

  const d = state.data;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style="dark" />

      {/* ─── Header Bar ─── */}
      <View style={[styles.header, { backgroundColor: surface, borderColor: border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.liveLabel, { color: '#10B981' }]}>LIVE</Text>
        </View>
        <Text style={[styles.headerTitle, { color: text }]}>
          Delivery Tracking
        </Text>
        <Text style={[styles.headerId, { color: textMut }]}>
          {d.trackingId}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Order Card ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <Ionicons name="document-text-outline" size={20} color={primary} />
            <Text style={[styles.cardTitle, { color: text }]}>Order Details</Text>
          </View>
          <InfoRow label="Job ID" value={d.jobId} colors={colors} />
          <InfoRow label="Purchase Order" value={d.poNumber || '—'} colors={colors} />
          <InfoRow label="Material" value={d.materialName || '—'} colors={colors} />
          <InfoRow
            label="Quantity Ordered"
            value={d.quantityOrdered != null ? `${d.quantityOrdered} tonnes` : '—'}
            colors={colors}
          />
          {d.materialSource ? (
            <InfoRow label="Material Source" value={d.materialSource} colors={colors} />
          ) : null}
        </View>

        {/* ─── Logistics Card ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <Ionicons name="bus-outline" size={20} color={primary} />
            <Text style={[styles.cardTitle, { color: text }]}>Logistics</Text>
          </View>
          <InfoRow label="Vendor" value={d.vendorName || '—'} colors={colors} />
          <InfoRow label="Truck (Plate)" value={d.plateNumber || '—'} colors={colors} />
          <InfoRow label="Driver" value={d.driverName || '—'} colors={colors} />
          <InfoRow
            label="Destination"
            value={d.siteName || '—'}
            colors={colors}
          />
        </View>

        {/* ─── Dispatch Proof Card ─── */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.cardHead}>
            <Ionicons name="shield-checkmark-outline" size={20} color={primary} />
            <Text style={[styles.cardTitle, { color: text }]}>Dispatch Proof</Text>
          </View>

          <InfoRow
            label="Quarry"
            value={d.quarryName || '—'}
            colors={colors}
          />
          <InfoRow
            label="Dispatched At"
            value={formatEAT(d.dispatchedAt)}
            colors={colors}
          />
          {d.netWeight != null ? (
            <InfoRow
              label="Net Weight (Quarry)"
              value={`${d.netWeight.toFixed(1)} tonnes`}
              colors={colors}
              valueColor={colors.success}
            />
          ) : d.weighOutWeight != null ? (
            <InfoRow
              label="Weigh-Out Weight"
              value={`${d.weighOutWeight.toFixed(1)} tonnes`}
              colors={colors}
            />
          ) : null}

          {/* ─── Driver Verification Photo ─── */}
          {d.driverPhotoURL ? (
            <View style={styles.photoSection}>
              <Text style={[styles.photoLabel, { color: textSec }]}>
                Driver Verification Photo
              </Text>
              <Image
                source={{ uri: d.driverPhotoURL }}
                style={[styles.driverPhoto, { borderColor: border }]}
                resizeMode="cover"
              />
            </View>
          ) : null}

          {/* ─── Quarry Dispatch Coordinates ─── */}
          {d.weighOutCoordinates ? (
            <TouchableOpacity
              style={[styles.coordRow, { borderColor: border }]}
              activeOpacity={0.7}
              onPress={() =>
                openMaps(
                  d.weighOutCoordinates?.latitude,
                  d.weighOutCoordinates?.longitude,
                  d.quarryName,
                )
              }
            >
              <Ionicons name="location" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.coordTitle, { color: text }]}>
                  Quarry Dispatch Location
                </Text>
                <Text style={[styles.coordValue, { color: textSec }]}>
                  {d.weighOutCoordinates.latitude?.toFixed(6)},{' '}
                  {d.weighOutCoordinates.longitude?.toFixed(6)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={textMut} />
            </TouchableOpacity>
          ) : d.quarryName ? (
            <View style={[styles.coordRow, { borderColor: border }]}>
              <Ionicons name="location-outline" size={18} color={textMut} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.coordTitle, { color: text }]}>
                  Quarry Location
                </Text>
                <Text style={[styles.coordValue, { color: textSec }]}>
                  {d.quarryName}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed-outline" size={14} color={textMut} />
          <Text style={[styles.footerText, { color: textMut }]}>
            This tracking link will automatically expire upon delivery.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ─── Mini Components ─── */

function InfoRow({
  label,
  value,
  colors,
  valueColor,
}: {
  label: string;
  value: string;
  colors: typeof Colors.light;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.infoValue,
          { color: valueColor || colors.text },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },

  /* ─── Header ─── */
  header: {
    paddingTop: 56,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerId: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  /* ─── Scroll ─── */
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  /* ─── Cards ─── */
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  /* ─── Info Rows ─── */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: Spacing.sm,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
    minWidth: 110,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },

  /* ─── Driver Photo ─── */
  photoSection: {
    marginTop: Spacing.sm,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  driverPhoto: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: '#F1F5F9',
  },

  /* ─── Coordinates ─── */
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: '#FFFBEB',
  },
  coordTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  coordValue: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  /* ─── Expired State ─── */
  expiredCard: {
    alignItems: 'center',
    maxWidth: 320,
    gap: Spacing.md,
  },
  expiredIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  expiredTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  expiredMessage: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  expiredDivider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    marginVertical: Spacing.xs,
  },
  expiredHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* ─── Loading ─── */
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: '500',
  },

  /* ─── Footer ─── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },
});