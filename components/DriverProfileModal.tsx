import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing } from '../constants/theme';
import { fetchDeliveryOrders, fetchDrivers, fetchVehicles } from '../services/api';
import { formatEAT } from '../utils/helpers';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GALLERY_COLS = 3;
const GALLERY_GAP = 6;
const GALLERY_ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.xl * 2 - GALLERY_GAP * (GALLERY_COLS - 1)) / GALLERY_COLS;

// Build storage URLs for quarry verification images
const STORAGE_BASE = 'https://storage.googleapis.com/trucksphere.firebasestorage.app';

function buildVerificationImageUrl(job: any): string {
  const jobId = job.jobId || job.id || 'unknown';
  const encodedPath = encodeURIComponent(`Deliveries/${jobId}.jpg`);
  return `${STORAGE_BASE}/${encodedPath}`;
}

interface DriverProfileModalProps {
  visible: boolean;
  driverId: string;
  driverData?: any; // optional pre-fetched driver data
  onClose: () => void;
}

export default function DriverProfileModal({ visible, driverId, driverData, onClose }: DriverProfileModalProps) {
  const colors = useTheme();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<any>(driverData || null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [verificationImages, setVerificationImages] = useState<{ uri: string; jobId: string; timestamp: string }[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const loadProfile = async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      // Load driver details and their recent jobs
      const [drivers, deliveries, vehicles] = await Promise.all([
        fetchDrivers(),
        fetchDeliveryOrders(),
        fetchVehicles(),
      ]);

      const foundDriver = (drivers || []).find((d: any) => d.id === driverId) || driverData || null;
      setDriver(foundDriver);

      // Recent jobs for this driver
      const driverJobs = (deliveries || [])
        .filter((d: any) => d.driverId === driverId)
        .sort((a:any, b:any) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime())
        .slice(0, 10);
      setRecentJobs(driverJobs);

      // Build verification image gallery from jobs with weighOut photos
      const imgs = driverJobs
        .filter((d: any) => d.quarryId && d.vendorId && d.driverId && d.vehicleId)
        .map((d: any) => ({
          uri: buildVerificationImageUrl(d),
          jobId: d.jobId || d.id || 'unknown',
          timestamp: d.weighOutAt || d.updatedAt || d.createdAt || '',
        }));
      setVerificationImages(imgs);
      setImageErrors({});

      // Find assigned vehicle (most recent plate number)
      const recentVehiclePlate = driverJobs.length > 0 ? driverJobs[0].plateNumber : null;
      if (recentVehiclePlate) {
        const v = (vehicles || []).find((veh: any) =>
          veh.plateNumber === recentVehiclePlate || veh.plate === recentVehiclePlate
        );
        setAssignedVehicle(v || null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && driverId) {
      if (driverData && !driver) {
        setDriver(driverData);
        setLoading(false);
      } else {
        loadProfile();
      }
    }
  }, [visible, driverId]);

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Could not open phone dialer.');
    });
  };

  const statusColor = driver?.status === 'active'
    ? '#10B981'
    : driver?.status === 'suspended'
    ? '#EF4444'
    : '#F59E0B';

  const statusLabel = driver?.status === 'active'
    ? 'Active'
    : driver?.status === 'suspended'
    ? 'Suspended'
    : driver?.status || 'Unknown';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, { color: colors.text }]}>Driver Profile</Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading driver profile...</Text>
            </View>
          ) : driver ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Avatar & Name Section */}
              <View style={styles.avatarSection}>
                {driver.photoURL ? (
                  <Image source={{ uri: driver.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: colors.primary }}>
                      {(driver.name || driver.fullName || 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.driverName, { color: colors.text }]}>
                  {driver.name || driver.fullName || 'Unknown Driver'}
                </Text>
                
              </View>

              {/* Contact Actions */}
              <View style={styles.actionRow}>
                {driver.phone ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}
                    onPress={() => handleCall(driver.phone)}
                  >
                    <Ionicons name="call-outline" size={18} color="#10B981" />
                    <Text style={[styles.actionText, { color: '#10B981' }]}>Call</Text>
                  </TouchableOpacity>
                ) : null}
                {driver.email ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#2563EB15', borderColor: '#2563EB33' }]}
                    onPress={() => Linking.openURL(`mailto:${driver.email}`)}
                  >
                    <Ionicons name="mail-outline" size={18} color="#2563EB" />
                    <Text style={[styles.actionText, { color: '#2563EB' }]}>Email</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Details Card */}
              <View style={[styles.detailCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Details</Text>

                {driver.licenseNumber ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="card-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>License</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{driver.licenseNumber}</Text>
                  </View>
                ) : null}

                {driver.phone ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Phone</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{driver.phone}</Text>
                  </View>
                ) : null}

                {driver.email ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{driver.email}</Text>
                  </View>
                ) : null}

                {driver.vendorName || driver.company ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Vendor</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{driver.vendorName || driver.company}</Text>
                  </View>
                ) : null}

                 
              </View>

              {/* Verification Image Gallery */}
              {verificationImages.length > 0 && (
                <View style={[styles.detailCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Verification Gallery</Text>
                  <Text style={[styles.gallerySubtitle, { color: colors.textMuted }]}>
                    Quarry weigh-out verification photos
                  </Text>
                  <View style={styles.galleryGrid}>
                    {verificationImages.map((img, idx) => (
                      <View key={idx} style={styles.galleryItem}>
                        {imageErrors[img.jobId] ? (
                          <View style={[styles.galleryFallback, { backgroundColor: `${colors.primary}08`, borderColor: colors.border }]}>
                            <Ionicons name="image-outline" size={20} color={colors.textTertiary} />
                            <Text style={[styles.galleryFallbackText, { color: colors.textTertiary }]} numberOfLines={1}>{img.jobId}</Text>
                          </View>
                        ) : (
                          <>
                            <Image
                              source={{ uri: img.uri }}
                              style={styles.galleryImage}
                              onError={() => setImageErrors((prev) => ({ ...prev, [img.jobId]: true }))}
                            />
                            <View style={styles.galleryOverlay}>
                              <Text style={styles.galleryJobId} numberOfLines={1}>{img.jobId}</Text>
                              <Text style={styles.galleryTimestamp}>{formatEAT(img.timestamp)}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Assigned Vehicle */}
              {assignedVehicle && (
                <View style={[styles.detailCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Current Vehicle</Text>
                  <View style={styles.detailRow}>
                    <Ionicons name="car-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Plate</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontWeight: '800' }]}>
                      {assignedVehicle.plateNumber || assignedVehicle.plate || 'N/A'}
                    </Text>
                  </View>
                  {(assignedVehicle.make || assignedVehicle.model) ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="construct-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Model</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {[assignedVehicle.make, assignedVehicle.model].filter(Boolean).join(' ')}
                      </Text>
                    </View>
                  ) : null}
                  {assignedVehicle.capacity != null ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Capacity</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{assignedVehicle.capacity} tonnes</Text>
                    </View>
                  ) : null}
                </View>
              )}
 

              <View style={{ height: Spacing['3xl'] }} />
            </ScrollView>
          ) : (
            <View style={styles.loadingWrap}>
              <Ionicons name="person-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Driver not found.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    maxHeight: '88%',
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 70,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  jobIdText: {
    fontSize: 13,
    fontWeight: '700',
  },
  jobMetaText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  jobStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  jobStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Verification Gallery
  gallerySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: Spacing.sm,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GALLERY_GAP,
  },
  galleryItem: {
    width: GALLERY_ITEM_SIZE,
    height: GALLERY_ITEM_SIZE,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
  },
  galleryFallback: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  galleryFallbackText: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  galleryJobId: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  galleryTimestamp: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 7,
    fontWeight: '600',
  },
});
