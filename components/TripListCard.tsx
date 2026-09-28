import { useFlagViewsStore } from '@/store/flagViewsStore';
import { useAuthStore } from '@/store/authStore';
import React from 'react';
import { TripMaterials } from './TripMaterials';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/theme';
import { formatEAT } from '../utils/helpers';
import { getDeliveryFlagReason, isDeliveryFlagged, isSecurityCleared, isSecurityFlagged, isSiteWeightFlagged } from '../utils/siteFlags';
import { DataCard } from './EnterpriseUI';

type TripListCardProps = {
  trip: any;
  driverPhoto?: string;
  onPress: () => void;
  bottomAction?: React.ReactNode;
};

/** A single source of truth for the compact dashboard and active-trip cards. */
export function TripListCard({ trip, driverPhoto, onPress, bottomAction }: TripListCardProps) {
  const colors = useTheme();
  const isWarehouse = Boolean(trip.isWarehouseDelivery || trip.warehouseJobId) || String(trip.deliveryOrigin || trip.materialSource || '').toLowerCase() === 'warehouse';
  const jobCardNumber = trip.jobCardNumber || trip.jobId || (trip.isBackorder ? 'Awaiting assignment' : '—');

  const siteFlagged = isDeliveryFlagged(trip);
  const securityFlagged = isSecurityFlagged(trip);
  const weightFlagged = isSiteWeightFlagged(trip);
  const securityCleared = isSecurityCleared(trip);
  const siteFlagReason = siteFlagged ? getDeliveryFlagReason(trip) : null;
  const isBackorder = Boolean(trip.isBackorder);
  const hasLinkedBackorder = isBackorder || Boolean(trip.backorderDeliveryOrderId);
  const backorderQuantity = isBackorder
    ? Number(trip.quantityOrdered || trip.remainingQuantity || 0)
    : Number(trip.backorderRemainingQuantity || 0);

  return (
    <DataCard
      style={[
        styles.card,
        securityFlagged && { borderColor: '#B45309', borderWidth: 1.5, backgroundColor: '#FFFBEB' },
        !securityFlagged && weightFlagged && { borderColor: '#DC2626', borderWidth: 1.5 },
        !siteFlagged && securityCleared && { borderColor: '#A78BFA', borderWidth: 1.5 },
      ]}
      onPress={() => { useFlagViewsStore.getState().markViewed(useAuthStore.getState().user?.uid || '', trip); onPress(); }}
    >
      <View style={styles.row}>
        {isWarehouse ? (
          <Ionicons name="business-outline" size={28} color={colors.primaryText} />
        ) : driverPhoto ? (
          <Image source={{ uri: driverPhoto }} style={styles.driverPhoto} />
        ) : !trip.driverId ? (
          <View style={[styles.driverPhoto, styles.driverPhotoFallback, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="person-outline" size={20} color={colors.primaryText} />
          </View>
        ) : null}
        <View style={styles.driverDetails}>
          <Text style={[styles.driverName, { color: colors.text }]} numberOfLines={1}>
            {isWarehouse ? 'From warehouse' : trip.driverName || 'Unassigned driver'}
          </Text>
          {!isWarehouse && <Text style={[styles.truckName, { color: colors.textMuted }]} numberOfLines={1}>
            {trip.plateNumber || 'No truck assigned'}
          </Text>}
        </View>
        <View style={styles.materialDetails}>
          <TripMaterials trip={trip} />
          <Text style={[styles.poReference, { color: colors.textMuted }]} numberOfLines={1}>
            PO: {String(trip.poNumber || '—').toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.vendorName, { color: colors.textMuted }]} numberOfLines={1}>
          {trip.vendorName || 'Unknown vendor'}
        </Text>
        <View style={styles.tripMeta}>
          <Text style={[styles.jobCardNumber, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
            {jobCardNumber}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textTertiary }]} numberOfLines={1}>
            {formatEAT(trip.updatedAt || trip.createdAt)}
          </Text>
        </View>
      </View>
      {siteFlagReason ? (
        <View style={styles.flagReason}>
          <Ionicons name="warning-outline" size={14} color="#B45309" />
          <Text style={[styles.flagReasonText, { color: colors.text }]}>{siteFlagReason}</Text>
        </View>
      ) : null}
      {!siteFlagged && securityCleared ? <Text style={[styles.clearedLabel, { color: colors.primaryText }]}>Unflagged — fleet unsuspended</Text> : null}
      
      {bottomAction}
    </DataCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 5, marginBottom: Spacing.xs,
  },
  clearedLabel: { color: '#6D28D9', fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  driverPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  driverPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
  },
  truckName: {
    fontSize: 12, marginTop: Spacing.xs,
  },
  materialDetails: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  materialName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  poReference: {
    fontSize: 11, marginTop: Spacing.xs,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vendorName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  tripMeta: {
    alignItems: 'flex-end',
    maxWidth: '55%',
  },
  jobCardNumber: {
    maxWidth: '100%',
    fontSize: 11,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 10, marginTop: Spacing.xs,
  },
  flagReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FCD34D',
  },
  flagReasonText: { color: '#92400E', flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  backorderStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  backorderStatusTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  backorderStatusMeta: { fontSize: 10, marginTop: Spacing.xs, fontWeight: '600' },
});
