import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/theme';
import { formatEAT } from '../utils/helpers';
import { getSiteWeightFlagReason, isSiteWeightFlagged } from '../utils/siteFlags';
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
  const jobCardNumber = trip.jobCardNumber || trip.jobId || (trip.isBackorder ? 'Awaiting assignment' : '—');

  const siteFlagged = isSiteWeightFlagged(trip);
  const siteFlagReason = siteFlagged ? getSiteWeightFlagReason(trip) : null;
  const isBackorder = Boolean(trip.isBackorder);
  const hasLinkedBackorder = isBackorder || Boolean(trip.backorderDeliveryOrderId);
  const backorderQuantity = isBackorder
    ? Number(trip.quantityOrdered || trip.remainingQuantity || 0)
    : Number(trip.backorderRemainingQuantity || 0);
  const odooReceiptNumber = isBackorder
    ? trip.odooReceiptNumber
    : trip.odooBackorderReceiptNumber;
  const odooSyncStatus = trip.odooReceiptSyncStatus || 'pending';
  const odooLabel = odooReceiptNumber
    ? `Odoo receipt: ${odooReceiptNumber}`
    : odooSyncStatus === 'synced'
      ? 'Odoo receipt synchronized'
      : odooSyncStatus === 'failed'
        ? 'Odoo receipt sync needs retry'
        : 'Awaiting Odoo receipt sync';

  return (
    <DataCard
      style={[
        styles.card,
        siteFlagged && { borderColor: colors.danger, borderWidth: 1.5 },
      ]}
      onPress={onPress}
    >
      <View style={styles.row}>
        {driverPhoto ? (
          <Image source={{ uri: driverPhoto }} style={styles.driverPhoto} />
        ) : !trip.driverId ? (
          <View style={[styles.driverPhoto, styles.driverPhotoFallback, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
        ) : null}
        <View style={styles.driverDetails}>
          <Text style={[styles.driverName, { color: colors.text }]} numberOfLines={1}>
            {trip.driverName || 'Unassigned driver'}
          </Text>
          <Text style={[styles.truckName, { color: colors.textMuted }]} numberOfLines={1}>
            {trip.plateNumber || 'No truck assigned'}
          </Text>
        </View>
        <View style={styles.materialDetails}>
          <Text style={[styles.materialName, { color: colors.text }]} numberOfLines={1}>
            {trip.materialName || 'Material'}
          </Text>
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
          <Text style={[styles.jobCardNumber, { color: colors.textSecondary }]} numberOfLines={1}>
            Job card: {jobCardNumber}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textTertiary }]} numberOfLines={1}>
            {formatEAT(trip.updatedAt || trip.createdAt)}
          </Text>
        </View>
      </View>
      {siteFlagReason ? (
        <View style={styles.flagReason}>
          <Ionicons name="warning-outline" size={14} color="#B91C1C" />
          <Text style={styles.flagReasonText}>{siteFlagReason}</Text>
        </View>
      ) : null}
      
      {bottomAction}
    </DataCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 5,
    marginBottom: 0.1,
  },
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
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 11,
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 1,
  },
  flagReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FECACA',
  },
  flagReasonText: { color: '#B91C1C', flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  backorderStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  backorderStatusTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  backorderStatusMeta: { fontSize: 10, marginTop: 1, fontWeight: '600' },
});
