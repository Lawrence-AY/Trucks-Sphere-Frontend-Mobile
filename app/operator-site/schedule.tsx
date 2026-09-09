import { isPurchaseOrderOpen } from '../../utils/poMaterials';
import { formatPurchaseOrderMaterials } from '../../utils/poMaterials';
import api from '../../services/api';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import {
  createDeliveryOrder,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
  receiveLot,
  updateDeliveryOrder,
} from '../../services/api';
import { uploadDeliveryNote, type UploadFile } from '../../services/uploadService';
import { useAuthStore } from '../../store/authStore';
import { canControlStatusBarAppearance } from '../../utils/statusBar';
import { useDeliveryOrders, useMaterials } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT, generateId, generateJobKey } from '../../utils/helpers';
import { normalizeJobStatus } from '../../utils/jobStatus';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  
} from '../../components/EnterpriseUI';
import DriverProfileModal from '../../components/DriverProfileModal';

/* ─────────── Phase 1: Schedule Tab — Site Weight In ─────────── */

const MATERIAL_SOURCE_OPTIONS = [
  'Hindi',
  'Ngomeni',
  'Jaribuni',
  'Mjanaheri Malindi',
  'Kilifi',
  'Malindi',
  'Local Borrow pit',
  'Witu',
  'Baragoni',
  'Warehouse'
];

const isWarehouseMaterial = (job: any, materialSource = '') =>
  Boolean(job?.isWarehouseDelivery) ||
  String(job?.deliveryOrigin || '').trim().toLowerCase() === 'warehouse' ||
  String(materialSource || job?.materialSource || '').trim().toLowerCase() === 'warehouse';

type CapturedDeliveryNote = UploadFile & {
  displayName: string;
};

export default function OperatorSiteDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  
  // Use realtime store for delivery orders — instant cache-first loading
  const rawDeliveries = useDeliveryOrders();
  const materials = useMaterials();
  const refresh = useRealTimeSyncStore((s) => s.refresh);
  const storeLoading = useRealTimeSyncStore((s) => s.isLoading);
  
  // Local state for deliveries filtered by site
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [fabDataLoaded, setFabDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ─── Weight In form state (per job) ───
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [weightInInputs, setWeightInInputs] = useState<Record<string, string>>({});
  const [lotInputs, setLotInputs] = useState<Record<string, string>>({});
  const [materialSourceInputs, setMaterialSourceInputs] = useState<Record<string, string>>({});
  const [materialSourceSearchInputs, setMaterialSourceSearchInputs] = useState<Record<string, string>>({});
  const [materialSourceOpenInputs, setMaterialSourceOpenInputs] = useState<Record<string, boolean>>({});
  const [bankerInputs, setBankerInputs] = useState<Record<string, string>>({});
  const [bankerOpenInputs, setBankerOpenInputs] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [denialReasons, setDenialReasons] = useState<Record<string, string>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});

  // ─── Success modal for Phase 1 completion ───
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successJob, setSuccessJob] = useState<any>(null);

  // Driver lookup map for resolving photoURL
  const [driverMap, setDriverMap] = useState<Record<string, any>>({});

  // Driver profile modal state
  const [driverProfileVisible, setDriverProfileVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDriverData, setSelectedDriverData] = useState<any>(null);
  const [selectedDriverJobId, setSelectedDriverJobId] = useState('');

  // Full-screen photo viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerUri, setPhotoViewerUri] = useState('');

  // ─── FAB / Unscheduled Arrival modal state ───
  const [fabVisible, setFabVisible] = useState(false);
  const [fabPoSearch, setFabPoSearch] = useState('');
  const [fabSelectedPo, setFabSelectedPo] = useState<any>(null);
  const [fabSelectedDriver, setFabSelectedDriver] = useState<any>(null);
  const [fabSelectedVehicle, setFabSelectedVehicle] = useState<any>(null);
  const [fabMaterialSource, setFabMaterialSource] = useState('');
  const [fabMaterialSourceSearch, setFabMaterialSourceSearch] = useState('');
  const [fabMaterialSourceOpen, setFabMaterialSourceOpen] = useState(false);
  const [fabBanker, setFabBanker] = useState('');
  const [fabBankerOpen, setFabBankerOpen] = useState(false);
  const [fabWeightIn, setFabWeightIn] = useState('');
  const [fabLotNumber, setFabLotNumber] = useState('');
  const [fabDeliveryNote, setFabDeliveryNote] = useState<CapturedDeliveryNote | null>(null);
  const [fabSubmitting, setFabSubmitting] = useState(false);
  const [fabSubmitError, setFabSubmitError] = useState('');

  // Site operators share a single receiving queue. The operator who records
  // the site weigh-in is stored on the delivery as the actual receiver.
  useEffect(() => {
    setDeliveries(rawDeliveries || []);
    if (rawDeliveries.length > 0) {
      setLoading(false);
    } else if (!storeLoading('deliveryOrders')) {
      // Store finished loading with empty data — stop spinner
      setLoading(false);
    }
  }, [rawDeliveries, storeLoading]);

  // Safety timeout: if loading persists > 10s, show data anyway
  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) setLoading(false);
    }, 10000);
    return () => clearTimeout(t);
  }, [loading]);

  // Lazy-load FAB data (drivers, POs, vehicles) only when opening the FAB
  const loadFabData = async () => {
    try {
      const [driverData, orders, vehicleData] = await Promise.all([
        fetchDrivers(),
        fetchPurchaseOrders(),
        fetchVehicles(),
      ]);
      setAllDrivers(driverData || []);
      setPurchaseOrders(orders || []);
      setAllVehicles(vehicleData || []);
      const map: Record<string, any> = {};
      (driverData || []).forEach((d: any) => { if (d.id) map[d.id] = d; });
      setDriverMap(map);
      setFabDataLoaded(true);
    } catch { /* keep the current data if a refresh fails */ }
  };

  // Refresh handler — uses the realtime store refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    // Also reload FAB data on pull-to-refresh
    if (fabDataLoaded) {
      try {
        const [driverData, orders, vehicleData] = await Promise.all([
          fetchDrivers(),
          fetchPurchaseOrders(),
          fetchVehicles(),
        ]);
        setAllDrivers(driverData || []);
        setPurchaseOrders(orders || []);
        setAllVehicles(vehicleData || []);
        const map: Record<string, any> = {};
        (driverData || []).forEach((d: any) => { if (d.id) map[d.id] = d; });
        setDriverMap(map);
      } catch { /* ignore */ }
    }
    setRefreshing(false);
  };

  /* ─── Filtered & categorized data ─── */

  // Only show trucks that have been weighed at quarry (weighIn + weighOut weight recorded)
  // and have NOT been weighed in at site yet — once weighed in, they move to Weights tab
  const allScheduled = useMemo(
    () => deliveries.filter((d) => {
      const status = normalizeJobStatus(d.status);
      if (['CANCELLED', 'COMPLETED', 'SITE_WEIGHED_OUT'].includes(status)) return false;
      // Security-stopped deliveries are reviewed only in Flagged Deliveries.
      // The clear action changes this state, so they reappear here immediately
      // after unsuspension without a separate client-side transition.
      if (d.securityFlag?.status === 'flagged' || d.isFlagged === true) return false;
      if (isWarehouseMaterial(d)) return !d.warehouseAcceptedAt && !d.warehouseDeniedAt && Boolean(d.packagingPhotoURL);
      if (d.siteWeighOutWeight != null) return false;
      // Exclude jobs that already have site arrival recorded — they belong on Weights tab
      if (d.siteWeighInWeight != null || d.siteArrivalWeight != null || status === 'SITE_WEIGHED_IN') return false;
      // Must have been weighed at quarry (has both weigh in and weigh out weights)
      const hasQuarryWeights = d.weighInWeight != null && d.weighOutWeight != null;
      const isSubmittedWarehouseDelivery = Boolean(d.isWarehouseDelivery && d.packagingPhotoURL) && ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_SITE'].includes(status);
      return hasQuarryWeights || isSubmittedWarehouseDelivery;
    }),
    [deliveries],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allScheduled.filter(
      (d) =>
        !q ||
        [d.jobId, d.driverName, d.plateNumber, d.materialName].some((v) =>
          String(v || '').toLowerCase().includes(q),
        ),
    );
  }, [allScheduled, search]);

  // Stats
  const stats = useMemo(() => {
    const pendingWeighIn = allScheduled.filter(
      (d) =>
        !d.siteWeighInWeight &&
        d.status !== 'completed' &&
        d.status !== 'delivered' &&
        d.status !== 'site_in',
    );
    const weighedIn = allScheduled.filter(
      (d) =>
        (d.siteWeighInWeight != null || d.status === 'site_in') &&
        d.status !== 'completed' &&
        d.status !== 'delivered',
    );
    const completed = allScheduled.filter(
      (d) => d.status === 'completed' || d.status === 'delivered',
    );
    return {
      pending: pendingWeighIn.length,
      weighedIn: weighedIn.length,
      completed: completed.length,
    };
  }, [allScheduled]);

  /* ─── Weight In Handlers ─── */

  const getWeightInput = (jobId: string): string => {
    return weightInInputs[jobId] || '';
  };

      const setWeightInput = (jobId: string, value: string) => {
    // Only allow numbers and a single decimal point
    const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setWeightInInputs((prev) => ({ ...prev, [jobId]: filtered }));
    // Clear error when user types
    if (submitErrors[jobId]) {
      setSubmitErrors((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const getLotInput = (jobId: string): string => {
    return lotInputs[jobId] || '';
  };

  const setLotInput = (jobId: string, value: string) => {
    setLotInputs((prev) => ({ ...prev, [jobId]: value }));
  };

  const toggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      // Clear any previous error
      setSubmitErrors((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleConfirmWeightIn = async (job: any) => {
    const inputValue = getWeightInput(job.id);
    const weightInNum = parseFloat(inputValue);

    if (isNaN(weightInNum) || weightInNum <= 0) {
      setSubmitErrors((prev) => ({
        ...prev,
        [job.id]: 'Please enter a valid weight (> 0).',
      }));
      return;
    }

    const lotValue = getLotInput(job.id).trim();
    if (!lotValue) {
      setSubmitErrors((prev) => ({
        ...prev,
        [job.id]: 'Storage lot is required.',
      }));
      return;
    }

    // Arrival variance is Site Weigh-In minus Quarry Weigh-Out. A variance
    // from -5.0T through +5.0T is accepted; anything beyond is flagged.
    const quarryWeighOut = Number(job.weighOutWeight || 0);
    const arrivalVariance = quarryWeighOut > 0 ? weightInNum - quarryWeighOut : null;

    if (arrivalVariance != null && Math.abs(arrivalVariance) > 5.0) {
      const signedVariance = `${arrivalVariance > 0 ? '+' : ''}${arrivalVariance.toFixed(1)}`;
      Alert.alert(
        'Weight Variance Alert',
        `Site Arrival Weight (${weightInNum.toFixed(1)}T) is ${signedVariance}T against the Quarry Weigh Out (${quarryWeighOut.toFixed(1)}T). This is outside the ±5.0T tolerance. Do you want to proceed?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Proceed',
            onPress: () => submitWeightIn(job, weightInNum),
          },
        ],
      );
      return;
    }

    submitWeightIn(job, weightInNum);
  };

  const submitWeightIn = async (job: any, weightInNum: number) => {
    if (job.securityFlag?.status === 'flagged' || job.isFlagged === true) {
      setSubmitErrors((prev) => ({ ...prev, [job.id]: 'This delivery is security-flagged. It cannot be weighed in until it is cleared and the fleet is unsuspended.' }));
      return;
    }
    setSubmitting((prev) => ({ ...prev, [job.id]: true }));
    setSubmitErrors((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });

    try {
      const now = new Date().toISOString();
      const lotValue = getLotInput(job.id).trim();
      const materialSourceValue = (materialSourceInputs[job.id] || '').trim();
      const warehouseMaterial = isWarehouseMaterial(job, materialSourceValue);
      const bankerValue = warehouseMaterial
        ? 'Warehouse-banker'
        : (bankerInputs[job.id] ?? job.banker ?? '').trim();
      if (!bankerValue) {
        setSubmitErrors((prev) => ({ ...prev, [job.id]: 'Enter the banker for this material.' }));
        setSubmitting((prev) => ({ ...prev, [job.id]: false }));
        return;
      }
      const transitionPayload = {
        siteWeighInWeight: weightInNum,
        siteWeighInAt: now,
        materialSource: materialSourceValue || undefined,
        banker: bankerValue,
        siteWeighInByUid: user?.uid || '',
        createdByUid: job.createdByUid || user?.uid || '',
        siteOperatorUid: user?.uid || '',
      };
      if (__DEV__) {
        console.debug('[SiteWeights] schedule save started', {
          documentId: job.id,
          documentBeforeUpdate: job,
          payload: transitionPayload,
        });
      }
      const persistedJob = await updateDeliveryOrder(job.id, transitionPayload);
      if (__DEV__) {
        console.debug('[SiteWeights] schedule save succeeded', {
          documentId: job.id,
          documentAfterUpdate: persistedJob,
        });
      }

      // Persist storage lot assignment if provided
      if (lotValue) {
        try {
          await receiveLot({ deliveryOrderId: job.id, storageLot: lotValue });
        } catch {
          // Lot assignment is best-effort; don't block weigh-in
        }
      }

      // Update local state
      setDeliveries((current) =>
        current.map((item) =>
          item.id === job.id
            ? {
                ...item,
                ...persistedJob,
                siteWeighInWeight: weightInNum,
                siteWeighInAt: now,
                status: 'site_in',
                workflowStage: 'ready_for_site_weights',
                currentStage: 'site_weights',
                siteArrivalCompleted: true,
                arrivalCompleted: true,
                updatedAt: now,
              }
            : item,
        ),
      );

      // Propagate to shared cache so Weights tab sees it immediately
      const updatedJob = {
        ...job,
        ...persistedJob,
        siteWeighInWeight: weightInNum,
        siteWeighInAt: now,
        status: 'site_in',
        workflowStage: 'ready_for_site_weights',
        currentStage: 'site_weights',
        siteArrivalCompleted: true,
        arrivalCompleted: true,
        updatedAt: now,
        materialSource: materialSourceValue || job.materialSource,
        banker: bankerValue,
        siteWeighInByUid: user?.uid || '',
        createdByUid: job.createdByUid || user?.uid || '',
        siteOperatorUid: user?.uid || '',
      };
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', updatedJob);
      useRealTimeSyncStore.getState().invalidateETag('deliveryOrders');

      // Clear inputs
      setWeightInInputs((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setLotInputs((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });

      setExpandedJobId(null);

      // Keep this job visible in its next-step state; navigation is optional.
      setSuccessJob(updatedJob);
      setSuccessModalVisible(true);
    } catch (error: any) {
      setSubmitErrors((prev) => ({
        ...prev,
        [job.id]: error?.message || 'Failed to submit weight. Please try again.',
      }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [job.id]: false }));
    }
  };

  const navigateToWeights = () => {
    setSuccessModalVisible(false);
    setSuccessJob(null);
    router.push('/operator-site/weights' as any);
  };

  /* ─── FAB: Unscheduled Arrival Handlers ─── */

  const fabMatchingPOs = useMemo(() => {
    const term = fabPoSearch.trim().toLowerCase();
    return purchaseOrders
      .filter(isPurchaseOrderOpen)
      .filter(
        (order) =>
          !term ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.vendorName?.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [fabPoSearch, purchaseOrders]);

  const fabVendorDrivers = useMemo(() => {
    if (!fabSelectedPo) return [];
    return allDrivers.filter(
      (driver) => driver.vendorId === fabSelectedPo.vendorId && driver.status === 'active',
    );
  }, [allDrivers, fabSelectedPo]);

  const fabVendorVehicles = useMemo(() => {
    if (!fabSelectedPo) return [];
    return allVehicles.filter(
      (vehicle) => vehicle.vendorId === fabSelectedPo.vendorId && vehicle.status === 'active',
    );
  }, [allVehicles, fabSelectedPo]);

  // New site-created jobs must retain every line on a multi-material PO.
  // Keep the legacy top-level material fields below for older consumers.
  const fabPoMaterials = useMemo(() => {
    if (!fabSelectedPo) return [];
    const lines = Array.isArray(fabSelectedPo.materials) && fabSelectedPo.materials.length
      ? fabSelectedPo.materials
      : [{
        materialId: fabSelectedPo.materialId,
        materialName: fabSelectedPo.materialName,
        quantity: fabSelectedPo.quantity,
        unit: fabSelectedPo.unit,
        isWarehouseMaterial: fabSelectedPo.isWarehouseMaterial,
      }];
    return lines.filter((line: any) => line?.materialId || line?.materialName);
  }, [fabSelectedPo]);

  const fabMaterialSourceMatches = useMemo(() => {
    const term = fabMaterialSourceSearch.trim().toLowerCase();
    if (!term) return MATERIAL_SOURCE_OPTIONS;
    return MATERIAL_SOURCE_OPTIONS.filter((source) => source.toLowerCase().includes(term));
  }, [fabMaterialSourceSearch]);

  // Banker selection uses only the top-level category of a non-warehouse
  // material; individual material names are intentionally not selectable.
  const bankerMaterialGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    (materials || [])
      .filter((material: any) => !material.isWarehouseMaterial)
      .forEach((material: any) => {
        const group = String(material.category || 'Other').trim() || 'Other';
        const name = String(material.name || '').trim();
        if (!name) return;
        groups.set(group, [...(groups.get(group) || []), name]);
      });
    return [...groups.entries()]
      .map(([name, items]) => ({ name, items: [...new Set(items)].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials]);

  const closeFab = () => {
    setFabVisible(false);
    setFabPoSearch('');
    setFabSelectedPo(null);
    setFabSelectedDriver(null);
    setFabSelectedVehicle(null);
    setFabMaterialSource('');
    setFabMaterialSourceSearch('');
    setFabMaterialSourceOpen(false);
    setFabBanker('');
    setFabBankerOpen(false);
    setFabWeightIn('');
    setFabLotNumber('');
    setFabDeliveryNote(null);
    setFabSubmitting(false);
    setFabSubmitError('');
  };

  const captureExternalDeliveryNote = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to capture the external delivery note.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFabDeliveryNote({
      uri: asset.uri,
      name: asset.fileName || `delivery-note-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      displayName: asset.fileName || 'Captured delivery note',
    });
  };

  const chooseExternalDeliveryNotePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Allow photo library access to select the external delivery note.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFabDeliveryNote({
      uri: asset.uri,
      name: asset.fileName || `delivery-note-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      displayName: asset.fileName || 'Selected delivery note',
    });
  };

  const chooseExternalDeliveryNoteFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFabDeliveryNote({
      uri: asset.uri,
      name: asset.name || `delivery-note-${Date.now()}.pdf`,
      mimeType: asset.mimeType || 'application/pdf',
      displayName: asset.name || 'Selected delivery note',
    });
  };

  const handleFabSubmit = async () => {
    if (!fabSelectedPo) return;
    const weightInNum = parseFloat(fabWeightIn);
    if (isNaN(weightInNum) || weightInNum <= 0) return;
    if (!fabLotNumber.trim()) return;
    if (!fabMaterialSource.trim()) return;
    const fabIsWarehouseMaterial = isWarehouseMaterial(null, fabMaterialSource);
    if (!fabIsWarehouseMaterial && !fabBanker.trim()) return;
    const hasValidDriver =  fabSelectedDriver;
    const hasValidVehicle = fabSelectedVehicle;
    if (!hasValidDriver || !hasValidVehicle) return;

    const now = new Date().toISOString();
    setFabSubmitting(true);
    setFabSubmitError('');

    const driverId =   fabSelectedDriver.id;
    const driverName =  (fabSelectedDriver.name || fabSelectedDriver.fullName);
    const licenseNumber =   (fabSelectedDriver.licenseNumber || '');
    const vehicleId =   fabSelectedVehicle.id;
    const plateNumber =  (fabSelectedVehicle.plateNumber || fabSelectedVehicle.plate || 'N/A');

    const jobKey = generateJobKey(fabSelectedPo.poNumber, fabSelectedPo.materialId, fabSelectedPo.vendorId, driverId, vehicleId);

    const payload = {
      id: generateId(),
      jobKey: jobKey,
      purchaseOrderId: fabSelectedPo.id,
      poNumber: fabSelectedPo.poNumber,
      vendorId: fabSelectedPo.vendorId,
      vendorName: fabSelectedPo.vendorName,
      driverId: driverId,
      driverName: driverName,
      licenseNumber: licenseNumber,
      vehicleId: vehicleId,
      plateNumber: plateNumber,
      materialId: fabSelectedPo.materialId,
      materialName: fabSelectedPo.materialName,
      quantityOrdered: Number(fabSelectedPo.quantity || 0),
      unit: fabSelectedPo.unit || '',
      materials: fabPoMaterials,
      quantityDelivered: 0,
      quarryId: fabSelectedPo.quarryId || user?.quarryId || '',
      quarryName: fabSelectedPo.quarryName || 'Quarry',
      siteId: fabSelectedPo.siteId || user?.siteId || '',
      siteName: fabSelectedPo.siteName || 'Site',
      destinationLot: fabLotNumber.trim(),
      materialSource: fabMaterialSource.trim(),
      banker: fabIsWarehouseMaterial ? 'Warehouse-banker' : fabBanker.trim(),
      isUnscheduled: true,
      isScheduled: false,
      
      status: 'site_in',
      siteWeighInWeight: weightInNum,
      siteWeighInAt: now,
      createdBy: 'operator_site',
      createdByUid: user?.uid || '',
      siteWeighInByUid: user?.uid || '',
      siteOperatorUid: user?.uid || '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const createdJob = await createDeliveryOrder(payload);
      let completedJob = createdJob;
      let deliveryNoteUploadFailed = false;
      if (fabDeliveryNote) {
        try {
          const uploaded = await uploadDeliveryNote(createdJob.id, fabDeliveryNote);
          completedJob = {
            ...createdJob,
            deliveryNoteURL: uploaded.photoURL,
            photoURL: uploaded.photoURL,
            deliveryNoteFileName: fabDeliveryNote.name,
            deliveryNoteMimeType: fabDeliveryNote.mimeType,
          };
        } catch {
          // The arrival has already been created. Do not encourage a second
          // submission, which would create a duplicate job card.
          deliveryNoteUploadFailed = true;
        }
      }
      // Optimistically push to shared cache so Weights tab sees it immediately
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', completedJob);
      useRealTimeSyncStore.getState().invalidateETag('deliveryOrders');
      setDeliveries((current) => [completedJob, ...current]);
      closeFab();
      setSuccessJob(completedJob);
      setSuccessModalVisible(true);
      if (deliveryNoteUploadFailed) {
        Alert.alert('Job registered', 'The job was registered, but the delivery note could not be uploaded. The note was not saved.');
      }
    } catch (error: any) {
      setFabSubmitError(error?.response?.data?.error || error?.message || 'Failed to register unscheduled arrival.');
    } finally {
      setFabSubmitting(false);
    }
  };

  /* ─── Render ─── */

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageShell
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search job, driver, plate, material..."
        />
        <SectionTitle title={`Schedule — ${filtered.length} deliveries`} />

        {loading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>
              Loading schedule...
            </Text>
          </DataCard>
        ) : filtered.length ? (
          filtered.slice(0, 30).map((item) => {
            if (isWarehouseMaterial(item)) return <View key={item.id} style={{ padding: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.jobId || item.id}</Text>
              <Text style={{ color: colors.textMuted }}>{item.vendorName} ? Warehouse</Text>
              {(item.materials?.length ? item.materials : [{ materialName: item.materialName, quantity: item.quantityOrdered, unit: item.unit }, ...(item.additionalItems || [])]).map((line: any, index: number) => <Text key={index} style={{ color: colors.text }}>{line.materialName}: {line.quantity} {line.unit}</Text>)}
              {item.packagingPhotoURL ? <Image source={{ uri: item.packagingPhotoURL }} style={{ width: 120, height: 90, marginVertical: 8 }} /> : null}
              <TextInput value={denialReasons[item.id] || ''} onChangeText={(reason) => setDenialReasons((current) => ({ ...current, [item.id]: reason }))} placeholder="Reason if denying delivery" placeholderTextColor={colors.textMuted} multiline style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 6 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity disabled={submitting[item.id]} style={{ flex: 1, backgroundColor: colors.primary, padding: 12, borderRadius: 6, opacity: submitting[item.id] ? 0.5 : 1 }} onPress={async () => {
                setSubmitting((current) => ({ ...current, [item.id]: true }));
                try {
                  const { data: accepted } = await api.post('/api/delivery-orders/' + encodeURIComponent(item.id) + '/accept-warehouse', {});
                  useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', accepted);
                  setDeliveries((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...accepted } : entry));
                  Alert.alert('Delivery accepted', 'The delivery is now awaiting inspection.');
                } catch (error: any) { Alert.alert('Unable to accept delivery', error?.message || 'Please try again.'); }
                finally { setSubmitting((current) => ({ ...current, [item.id]: false })); }
              }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{submitting[item.id] ? 'Accepting...' : 'Accept delivery'}</Text></TouchableOpacity>
              <TouchableOpacity disabled={submitting[item.id]} style={{ flex: 1, backgroundColor: colors.danger, padding: 12, borderRadius: 6, opacity: submitting[item.id] ? 0.5 : 1 }} onPress={async () => {
                const reason = (denialReasons[item.id] || '').trim();
                if (!reason) return Alert.alert('Reason required', 'Enter a reason for denying this delivery.');
                setSubmitting((current) => ({ ...current, [item.id]: true }));
                try {
                  const { data: denied } = await api.post('/api/delivery-orders/' + encodeURIComponent(item.id) + '/deny-warehouse', { reason });
                  useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', denied);
                  setDeliveries((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...denied } : entry));
                  Alert.alert('Delivery denied', 'The denial has been recorded for the vendor and management.');
                } catch (error: any) { Alert.alert('Unable to deny delivery', error?.message || 'Please try again.'); }
                finally { setSubmitting((current) => ({ ...current, [item.id]: false })); }
              }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Deny delivery</Text></TouchableOpacity>
              </View>
            </View>;

            const hasQuarryWeights =
              item.weighInWeight != null && item.weighOutWeight != null;
            const quarryNet =
              item.netWeight ??
              (hasQuarryWeights
                ? item.weighInWeight - item.weighOutWeight
                : null);
            const isExpanded = expandedJobId === item.id;
            const isSubmitting = submitting[item.id];
            const error = submitErrors[item.id];
            const weightInVal = getWeightInput(item.id);
            const hasSiteWeighIn = item.siteWeighInWeight != null || normalizeJobStatus(item.status) === 'SITE_WEIGHED_IN';
            const enteredSiteWeighIn = parseFloat(weightInVal);
            const quarryWeighOut = Number(item.weighOutWeight || 0);
            const arrivalVariance = quarryWeighOut > 0 && Number.isFinite(enteredSiteWeighIn)
              ? enteredSiteWeighIn - quarryWeighOut
              : null;
            const isArrivalVarianceFlagged = arrivalVariance != null && Math.abs(arrivalVariance) > 5;
            const isSecurityFlagged = item.securityFlag?.status === 'flagged' || item.isFlagged === true;
            const isWeightFlagged = item.siteArrivalWeightVarianceFlagged === true || item.hasWeightDiscrepancy === true;
            const isDeliveryFlagged = isSecurityFlagged || isWeightFlagged;
            const isSecurityCleared = item.securityFlag?.status === 'cleared';
            const deliveryFlagReason = item.securityFlag?.status === 'flagged'
              ? item.securityFlag.reason || 'Security review is required.'
              : item.siteArrivalWeightVarianceReason || item.siteFlagReason || item.flagReason || item.differenceNote || 'Weight variance requires review.';

            return (
              <DataCard key={item.id} style={isSecurityFlagged ? { borderColor: '#B45309', borderWidth: 1.5, backgroundColor: '#FFFBEB' } : isWeightFlagged ? { borderColor: '#DC2626', borderWidth: 1.5 } : isSecurityCleared ? { borderColor: '#A78BFA', borderWidth: 1.5 } : undefined}>
                {/* Card Header — entire card tappable for weigh-in */}
                <TouchableOpacity
                  onPress={() => {
                    if (hasSiteWeighIn) {
                      router.push('/operator-site/weights' as any);
                    } else if (isSecurityFlagged) {
                      setSubmitErrors((prev) => ({ ...prev, [item.id]: 'This delivery is security-flagged. It cannot be weighed in until it is cleared and the fleet is unsuspended.' }));
                    } else {
                      toggleExpand(item.id);
                    }
                  }}
                  activeOpacity={0.7}
                  style={styles.cardHeaderTouchable}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jobId, { color: colors.text }]}>
                        {item.jobId}
                      </Text>
                      <Text
                        style={[styles.poText, { color: colors.textMuted }]}
                      >
                        {item.poNumber || 'No PO'}
                      </Text>
                    </View>
                  </View>

                  <DetailRow multiline
                    icon="cube-outline"
                    value={`${formatPurchaseOrderMaterials(item) || 'Material'}`}
                  />
                  <DetailRow
                    icon="business-outline"
                    value={`Vendor: ${item.vendorName || 'N/A'}`}
                  />
                  <DetailRow
                    icon="location-outline"
                    value={`From: ${item.isWarehouseDelivery ? 'Warehouse' : item.quarryLocation || item.materialSource || item.weighOutGeoLocation?.city || item.weighOutGeoLocation?.town || item.weighOutGeoLocation?.district || item.weighOutGeoLocation?.name || item.weighOutLocation || item.quarryName || 'Quarry'}`}
                  />
                  {/* Quarry Weights (Weigh Out + Net Weight) */}
                  {hasQuarryWeights && (
                    <View style={styles.quarryWeightsRow}>
                      {item.weighOutWeight != null && (
                        <View
                          style={[
                            styles.quarryWeightBadge,
                            { backgroundColor: '#F59E0B12', borderColor: '#F59E0B33' },
                          ]}
                        >
                          <Text
                            style={[styles.quarryWeightLabel, { color: '#D97706' }]}
                          >
                            Quarry WO: {item.weighOutWeight.toFixed(1)}T
                          </Text>
                        </View>
                      )}
                      {quarryNet != null && (
                        <View
                          style={[
                            styles.quarryWeightBadge,
                            { backgroundColor: '#2563EB12', borderColor: '#2563EB33' },
                          ]}
                        >
                          <Text
                            style={[styles.quarryWeightLabel, { color: '#2563EB' }]}
                          >
                            Quarry Net: {quarryNet.toFixed(1)}T
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Driver Verification Photo from Quarry Weigh-Out */}
                  {item.driverPhotoURL ? (
                    <TouchableOpacity
                      style={styles.dispatchPhotoSection}
                      activeOpacity={0.8}
                      onPress={() => {
                        setPhotoViewerUri(item.driverPhotoURL);
                        setPhotoViewerVisible(true);
                      }}
                    >
                      <View style={styles.dispatchPhotoHeader}>
                        <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.dispatchPhotoLabel, { color: colors.textMuted }]}>Dispatch Photo</Text>
                      </View>
                      <Image
                        source={{ uri: item.driverPhotoURL }}
                        style={[styles.dispatchPhotoThumb, { borderColor: colors.border }]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}

                  {item.packagingPhotoURL ? (
                    <TouchableOpacity
                      style={styles.dispatchPhotoSection}
                      activeOpacity={0.8}
                      onPress={() => {
                        setPhotoViewerUri(item.packagingPhotoURL);
                        setPhotoViewerVisible(true);
                      }}
                    >
                      <View style={styles.dispatchPhotoHeader}>
                        <Ionicons name="archive-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.dispatchPhotoLabel, { color: colors.textMuted }]}>Receipt Photo</Text>
                      </View>
                      <Image
                        source={{ uri: item.packagingPhotoURL }}
                        style={[styles.dispatchPhotoThumb, { borderColor: colors.border }]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}

                  <Text
                    style={[styles.timestamp, { color: colors.textTertiary }]}
                  >
                    {`${item.isWarehouseDelivery ? 'Submitted' : 'Dispatched'}: ${formatEAT(item.weighOutAt || item.submittedAt || item.updatedAt || item.createdAt)}`}
                  </Text>

                  {isSecurityCleared && !isDeliveryFlagged ? <View style={[styles.tapHint, { borderWidth: 1, borderColor: '#C4B5FD' }]}><Ionicons name="checkmark-circle-outline" size={12} color="#7C3AED" /><Text style={[styles.tapHintText, { color: '#6D28D9' }]}>Unflagged — fleet unsuspended</Text></View> : null}

                  {isDeliveryFlagged ? (
                    <View style={[styles.tapHint, { backgroundColor: isSecurityFlagged ? '#FFFBEB' : '#FEF2F2', borderWidth: 1, borderColor: isSecurityFlagged ? '#FCD34D' : '#FCA5A5' }]}>
                      <Ionicons name="flag" size={12} color={isSecurityFlagged ? '#B45309' : '#DC2626'} />
                      <Text style={[styles.tapHintText, { color: isSecurityFlagged ? '#92400E' : '#B91C1C' }]}>Flagged: {deliveryFlagReason}</Text>
                    </View>
                  ) : null}

                  {hasSiteWeighIn && (
                    <View style={[styles.tapHint, { backgroundColor: '#10B98112' }]}>
                      <Ionicons name="checkmark-circle-outline" size={12} color="#10B981" />
                      <Text style={[styles.tapHintText, { color: '#059669' }]}>Site arrival recorded — tap to continue to Weight Out</Text>
                    </View>
                  )}

                  {hasSiteWeighIn && item.siteArrivalWeightVariance != null ? (
                    <View style={[styles.tapHint, { backgroundColor: item.siteArrivalWeightVarianceFlagged ? '#FEF2F2' : '#ECFDF5' }]}>
                      <Ionicons name={item.siteArrivalWeightVarianceFlagged ? 'warning-outline' : 'checkmark-circle-outline'} size={12} color={item.siteArrivalWeightVarianceFlagged ? '#DC2626' : '#059669'} />
                      <Text style={[styles.tapHintText, { color: item.siteArrivalWeightVarianceFlagged ? '#B91C1C' : '#047857' }]}>
                        Arrival variance: {item.siteArrivalWeightVariance > 0 ? '+' : ''}{Number(item.siteArrivalWeightVariance).toFixed(1)}T {item.siteArrivalWeightVarianceFlagged ? '— flagged' : '— within tolerance'}
                      </Text>
                    </View>
                  ) : null}

                  {/* Tap hint */}
                  {!isExpanded && !hasSiteWeighIn && (
                    <View
                      style={[
                        styles.tapHint,
                        { backgroundColor: `${colors.primary}08` },
                      ]}
                    >
                      <Ionicons
                        name="hand-left-outline"
                        size={12}
                        color={colors.primaryText}
                      />
                      <Text
                        style={[styles.tapHintText, { color: colors.primaryText }]}
                      >
                        Tap to record Site Arrival Weight
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Driver row — separate touchable to open driver profile */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs}}
                  activeOpacity={0.6}
                  onPress={() => {
                    const d = driverMap[item.driverId];
                    if (!item.driverId) return;
                    // The driver map is loaded lazily for the FAB. Open the
                    // bottom sheet even before that cache is populated; the
                    // sheet will fetch the driver details itself.
                    setSelectedDriverId(item.driverId);
                    setSelectedDriverData(d || null);
                    setSelectedDriverJobId(item.jobId);
                    setDriverProfileVisible(true);
                  }}
                >
                  {driverMap[item.driverId]?.photoURL ? (
                    <Image source={{ uri: driverMap[item.driverId].photoURL }} style={styles.driverAvatarSmall} />
                  ) : (
                    <View style={[styles.driverAvatarSmall, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primaryText }}>
                        {(driverMap[item.driverId]?.name || item.driverName || 'D').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      {item.driverName || 'Unassigned'}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                      {item.plateNumber || 'N/A'}
                    </Text>
                  </View>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* ─── Expanded Weight In Form ─── */}
                {isExpanded && !hasSiteWeighIn && (
                  <View style={styles.weightInSection}>
                    <View
                      style={[
                        styles.weightInDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View
                      style={[
                        styles.weightInHeader,
                        { backgroundColor: '#F59E0B10', borderColor: '#F59E0B33' },
                      ]}
                    >
                      <View style={styles.weightInStageBadge}>
                        <Ionicons
                          name="download-outline"
                          size={18}
                          color="#F59E0B"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.weightInTitle,
                            { color: colors.text },
                          ]}
                        >
                          Site Arrival Weight (Weight In)
                        </Text>
                        <Text
                          style={[
                            styles.weightInSubtitle,
                            { color: colors.textMuted },
                          ]}
                        >
                          Weigh the fully-loaded truck upon arrival at site.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.weightInputContainer,
                        {
                          borderColor: error
                            ? colors.danger
                            : '#F59E0B',
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.weightInputField, { color: colors.text }]}
                        placeholder="0.0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={weightInVal}
                        onChangeText={(value) =>
                          setWeightInput(item.id, value)
                        }
                        autoFocus
                      />
                      <Text
                        style={[
                          styles.weightInputSuffix,
                          { color: colors.textMuted },
                        ]}
                      >
                        Tonnes
                      </Text>
                    </View>

                    {arrivalVariance != null ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6, marginTop: Spacing.xs,
                          padding: Spacing.sm,
                          borderRadius: Radius.md,
                          backgroundColor: isArrivalVarianceFlagged ? '#FEF2F2' : '#ECFDF5',
                          borderWidth: 1,
                          borderColor: isArrivalVarianceFlagged ? '#FECACA' : '#A7F3D0',
                        }}
                      >
                        <Ionicons
                          name={isArrivalVarianceFlagged ? 'warning-outline' : 'checkmark-circle-outline'}
                          size={17}
                          color={isArrivalVarianceFlagged ? '#DC2626' : '#059669'}
                        />
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: isArrivalVarianceFlagged ? '#B91C1C' : '#047857' }}>
                          Arrival variance: {arrivalVariance > 0 ? '+' : ''}{arrivalVariance.toFixed(1)}T
                          {isArrivalVarianceFlagged ? ' — outside ±5.0T tolerance' : ' — within ±5.0T tolerance'}
                        </Text>
                      </View>
                    ) : null}

                    {/* Storage Lot Input */}
                    <View style={[styles.lotInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                      <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.lotInputField, { color: colors.text }]}
                        placeholder="Storage Lot (e.g., Lot 4, Zone B-12)"
                        placeholderTextColor={colors.textTertiary}
                        value={getLotInput(item.id)}
                        onChangeText={(value) => setLotInput(item.id, value)}
                      />
                    </View>

                     {/* Material Source Selector — hidden when job is from quarry (has quarry weights) */}
                     {!hasQuarryWeights && (
                       <View style={[styles.fabSourceBlock, { marginBottom: Spacing.xs}]}>
                         <TouchableOpacity
                           style={[styles.fabInputWrap, { borderColor: (materialSourceInputs[item.id] || '').trim() ? colors.primary : colors.border, backgroundColor: colors.inputBg }]}
                           activeOpacity={0.8}
                           onPress={() => {
                             setMaterialSourceOpenInputs((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                           }}
                         >
                           <Ionicons name="map-outline" size={18} color={colors.textMuted} />
                           <TextInput
                             style={[styles.fabInput, { color: colors.text }]}
                             placeholder="Select material source (quarry)"
                             placeholderTextColor={colors.textTertiary}
                             value={materialSourceOpenInputs[item.id] ? (materialSourceSearchInputs[item.id] || '') : (materialSourceInputs[item.id] || '')}
                             onFocus={() => {
                               setMaterialSourceOpenInputs((prev) => ({ ...prev, [item.id]: true }));
                               setMaterialSourceSearchInputs((prev) => ({ ...prev, [item.id]: '' }));
                             }}
                             onChangeText={(value) => {
                               setMaterialSourceSearchInputs((prev) => ({ ...prev, [item.id]: value }));
                               setMaterialSourceOpenInputs((prev) => ({ ...prev, [item.id]: true }));
                             }}
                           />
                           <Ionicons name={materialSourceOpenInputs[item.id] ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                         </TouchableOpacity>
                         {materialSourceOpenInputs[item.id] && (
                           <View style={[styles.fabDropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                             {MATERIAL_SOURCE_OPTIONS.filter((source) => {
                               const term = (materialSourceSearchInputs[item.id] || '').trim().toLowerCase();
                               return !term || source.toLowerCase().includes(term);
                             }).length ? (
                               MATERIAL_SOURCE_OPTIONS.filter((source) => {
                                 const term = (materialSourceSearchInputs[item.id] || '').trim().toLowerCase();
                                 return !term || source.toLowerCase().includes(term);
                               }).map((source) => {
                                 const active = (materialSourceInputs[item.id] || '') === source;
                                 return (
                                   <TouchableOpacity
                                     key={source}
                                     style={[styles.fabDropdownItem, active && { backgroundColor: `${colors.primary}10` }]}
                                     onPress={() => {
                                       setMaterialSourceInputs((prev) => ({ ...prev, [item.id]: source }));
                                       setMaterialSourceSearchInputs((prev) => ({ ...prev, [item.id]: '' }));
                                       setMaterialSourceOpenInputs((prev) => ({ ...prev, [item.id]: false }));
                                     }}
                                   >
                                     <Text style={[styles.fabDropdownText, { color: colors.text }]}>{source}</Text>
                                     {active ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
                                   </TouchableOpacity>
                                 );
                               })
                             ) : (
                               <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No matching source.</Text>
                             )}
                           </View>
                         )}
                       </View>
                     )}

                    {!isWarehouseMaterial(item, materialSourceInputs[item.id]) && (
                      <View style={styles.bankerPickerBlock}>
                        <TouchableOpacity
                          style={[styles.fabInputWrap, { borderColor: (bankerInputs[item.id] ?? item.banker ?? '').trim() ? colors.primary : colors.border, backgroundColor: colors.inputBg }]}
                          activeOpacity={0.8}
                          onPress={() => setBankerOpenInputs((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        >
                          <Ionicons name="archive-outline" size={18} color={colors.textMuted} />
                          <Text style={[styles.fabInput, styles.bankerPickerText, (bankerInputs[item.id] ?? item.banker ?? '') ? styles.bankerPickerSelected : null, { color: (bankerInputs[item.id] ?? item.banker ?? '') ? colors.text : colors.textTertiary }]}>
                            {bankerInputs[item.id] ?? item.banker ?? 'Select banker'}
                          </Text>
                          <Ionicons name={bankerOpenInputs[item.id] ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                        {bankerOpenInputs[item.id] && (
                          <View style={[styles.fabDropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            {bankerMaterialGroups.length === 0 ? <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No non-warehouse material categories are available.</Text> : bankerMaterialGroups.map((group) => {
                              const active = (bankerInputs[item.id] ?? item.banker ?? '') === group.name;
                              return <TouchableOpacity key={group.name} style={[styles.fabDropdownItem, active && { backgroundColor: `${colors.primary}10` }]} onPress={() => {
                                setBankerInputs((prev) => ({ ...prev, [item.id]: group.name }));
                                setBankerOpenInputs((prev) => ({ ...prev, [item.id]: false }));
                              }}>
                              <Text style={[styles.fabDropdownText, { color: colors.text }]}>{group.name}</Text>
                              {active ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
                            </TouchableOpacity>;
                            })}
                          </View>
                        )}
                      </View>
                    )}

                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    <View style={styles.weightInActions}>
                      <TouchableOpacity
                        style={[
                          styles.cancelWeightInBtn,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => toggleExpand(item.id)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.cancelWeightInText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.confirmWeightInBtn,
                          {
                            backgroundColor:
                              weightInVal && !isSubmitting
                                ? '#F59E0B'
                                : colors.border,
                          },
                        ]}
                        onPress={() => handleConfirmWeightIn(item)}
                        disabled={!weightInVal || isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color="#FFFFFF"
                          />
                        )}
                        <Text style={styles.confirmWeightInText}>
                          {isSubmitting
                            ? 'Submitting...'
                            : 'Confirm & Submit'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </DataCard>
            );
          })
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No deliveries"
            subtitle="No job cards have been dispatched yet."
          />
        )}

        {/* Bottom spacing */}
        <View style={{ height: Spacing['4xl'] }} />
      </PageShell>

      {/* ─── FAB: Register Unscheduled Arrival ─── */}
      <TouchableOpacity
        style={[styles.fabBtn, { backgroundColor: colors.primary }]}
        onPress={() => { loadFabData(); setFabVisible(true); }}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ─── FAB Modal: Register Unscheduled Arrival ─── */}
      <Modal visible={fabVisible} transparent animationType="slide" onRequestClose={closeFab}>
        <KeyboardAvoidingView style={styles.fabModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
          <View style={[styles.fabSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.xl }}>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Register Unscheduled Arrival</Text>
                  <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                    Enter a Purchase Order, assign driver and vehicle, and specify the destination lot.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.inputBg }]} onPress={closeFab}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PO Search */}
              <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.fabInput, { color: colors.text }]}
                  placeholder="Search PO (e.g. POMAT004/V01)"
                  placeholderTextColor={colors.textTertiary}
                  value={fabSelectedPo ? fabSelectedPo.poNumber : fabPoSearch}
                  onChangeText={(value) => { setFabPoSearch(value); setFabSelectedPo(null); setFabSelectedDriver(null); setFabSelectedVehicle(null); }}
                />
              </View>

              {!fabSelectedPo ? (
                <View style={styles.fabOptionList}>
                  {fabMatchingPOs.map((order) => (
                    <TouchableOpacity
                      key={order.id}
                      style={[styles.fabOptionRow, { borderColor: colors.border }]}
                      onPress={() => { setFabSelectedPo(order); setFabPoSearch(order.poNumber); setFabSelectedDriver(null); setFabSelectedVehicle(null); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{order.poNumber}</Text>
                        <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>{order.vendorName} · {formatPurchaseOrderMaterials(order)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.fabSelectedBlock}>
                  <Text style={[styles.fabPrefillTitle, { color: colors.text }]}>Order Details</Text>
                  <DetailRow icon="document-outline" value={`Order: ${fabSelectedPo.poNumber}`} />
                  <DetailRow icon="business-outline" value={`Vendor: ${fabSelectedPo.vendorName}`} />
                  <View style={styles.fabPoMaterials}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Materials on PO</Text>
                    {fabPoMaterials.map((line: any, index: number) => (
                      <DetailRow
                        key={`${line.materialId || line.materialName || 'material'}-${index}`}
                        icon="cube-outline"
                        value={`${line.materialName || 'Material'}${line.quantity != null ? ` · ${line.quantity} ${line.unit || ''}` : ''}`}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Driver Selection */}
              {fabSelectedPo && (
                <>
                  <View style={styles.fabSectionHeader}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Select Driver</Text>
                    
                  </View>

                  
                    <ScrollView style={styles.fabSelectionList} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator>
                    <View style={styles.fabOptionList}>
                      {fabVendorDrivers.length ? (
                        fabVendorDrivers.map((driver) => {
                          const active = fabSelectedDriver?.id === driver.id;
                          return (
                            <TouchableOpacity
                              key={driver.id}
                              style={[styles.fabDriverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                              onPress={() => setFabSelectedDriver(driver)}
                            >
                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                              {driver.photoURL ? (
                                <Image source={{ uri: driver.photoURL }} style={styles.fabDriverPhoto} />
                              ) : (
                                <View style={[styles.fabDriverPhoto, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primaryText }}>
                                    {(driver.name || driver.fullName || 'D').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{driver.name || driver.fullName}</Text>
                                <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>License: {driver.licenseNumber}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No active drivers for this vendor.</Text>
                      )}
                    </View>
                    </ScrollView>
                  
                </>
              )}

              {/* Vehicle Selection */}
              {fabSelectedPo && (
                <>
                  <View style={styles.fabSectionHeader}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Select Vehicle (Number Plate)</Text>
                    
                  </View>
 
                    <ScrollView style={styles.fabSelectionList} nestedScrollEnabled showsVerticalScrollIndicator>
                    <View style={styles.fabOptionList}>
                      {fabVendorVehicles.length ? (
                        fabVendorVehicles.map((vehicle) => {
                          const active = fabSelectedVehicle?.id === vehicle.id;
                          return (
                            <TouchableOpacity
                              key={vehicle.id}
                              style={[styles.fabDriverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                              onPress={() => setFabSelectedVehicle(vehicle)}
                            >
                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{vehicle.plateNumber || vehicle.plate}</Text>
                                <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>{vehicle.make} {vehicle.model} ({vehicle.capacity}t)</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No active vehicles for this vendor.</Text>
                      )}
                    </View>
                    </ScrollView>
                
                </>
              )}

              {/* Site Arrival Weight (Weight In) */}
              {fabSelectedPo && (
                <>
                  <View style={styles.fabSourceBlock}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Material Source (Unscheduled)</Text>
                    <TouchableOpacity
                      style={[styles.fabInputWrap, { borderColor: fabMaterialSource ? colors.primary : colors.border, backgroundColor: colors.inputBg }]}
                      activeOpacity={0.8}
                      onPress={() => setFabMaterialSourceOpen((open) => !open)}
                    >
                      <Ionicons name="map-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.fabInput, { color: colors.text }]}
                        placeholder="Select material source"
                        placeholderTextColor={colors.textTertiary}
                        value={fabMaterialSourceOpen ? fabMaterialSourceSearch : fabMaterialSource}
                        onFocus={() => {
                          setFabMaterialSourceOpen(true);
                          setFabMaterialSourceSearch('');
                        }}
                        onChangeText={(value) => {
                          setFabMaterialSourceSearch(value);
                          setFabMaterialSourceOpen(true);
                        }}
                      />
                      <Ionicons name={fabMaterialSourceOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    {fabMaterialSourceOpen && (
                      <View style={[styles.fabDropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        {fabMaterialSourceMatches.length ? (
                          fabMaterialSourceMatches.map((source) => {
                            const active = fabMaterialSource === source;
                            return (
                              <TouchableOpacity
                                key={source}
                                style={[styles.fabDropdownItem, active && { backgroundColor: `${colors.primary}10` }]}
                                onPress={() => {
                                  setFabMaterialSource(source);
                                  setFabMaterialSourceSearch('');
                                  setFabMaterialSourceOpen(false);
                                }}
                              >
                                <Text style={[styles.fabDropdownText, { color: colors.text }]}>{source}</Text>
                                {active ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No matching source.</Text>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={[styles.weightInputContainer, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}>
                    <TextInput
                      style={[styles.weightInputField, { color: colors.text }]}
                      placeholder="0.0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={fabWeightIn}
                      onChangeText={(value) => {
                        const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                        setFabWeightIn(filtered);
                      }}
                    />
                    <Text style={[styles.weightInputSuffix, { color: colors.textMuted }]}>Tonnes</Text>
                  </View>

                  {!isWarehouseMaterial(null, fabMaterialSource) && (
                    <View style={styles.bankerPickerBlock}>
                      <TouchableOpacity
                        style={[styles.fabInputWrap, { borderColor: fabBanker ? colors.primary : colors.border, backgroundColor: colors.inputBg }]}
                        activeOpacity={0.8}
                        onPress={() => setFabBankerOpen((open) => !open)}
                      >
                        <Ionicons name="archive-outline" size={18} color={colors.textMuted} />
                        <Text style={[styles.fabInput, styles.bankerPickerText, fabBanker ? styles.bankerPickerSelected : null, { color: fabBanker ? colors.text : colors.textTertiary }]}>{fabBanker || 'Select banker'}</Text>
                        <Ionicons name={fabBankerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                      {fabBankerOpen && (
                        <View style={[styles.fabDropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                          {bankerMaterialGroups.length === 0 ? <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No non-warehouse material categories are available.</Text> : bankerMaterialGroups.map((group) => {
                            const active = fabBanker === group.name;
                            return <TouchableOpacity key={group.name} style={[styles.fabDropdownItem, active && { backgroundColor: `${colors.primary}10` }]} onPress={() => { setFabBanker(group.name); setFabBankerOpen(false); }}>
                            <Text style={[styles.fabDropdownText, { color: colors.text }]}>{group.name}</Text>
                            {active ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
                          </TouchableOpacity>;
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Storage Lot Input */}
              {fabSelectedPo && (
                <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.fabInput, { color: colors.text }]}
                    placeholder="Storage Lot (e.g., Lot 4, Zone B-12)"
                    placeholderTextColor={colors.textTertiary}
                    value={fabLotNumber}
                    onChangeText={setFabLotNumber}
                  />
                </View>
              )}

              {fabSelectedPo && (
                <View style={[styles.fabDeliveryNote, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                  <View style={styles.fabDeliveryNoteHeader}>
                    <Ionicons name="document-attach-outline" size={19} color={colors.primaryText} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fabLabel, { color: colors.text, marginTop: Spacing.xs}]}>External Delivery Note</Text>
                      <Text style={[styles.fabNoteHelp, { color: colors.textMuted }]}>Optional — photograph a paper note or attach an image/PDF issued elsewhere.</Text>
                    </View>
                  </View>
                  <View style={styles.fabNoteActions}>
                    <TouchableOpacity
                      style={[styles.fabNoteAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={captureExternalDeliveryNote}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.primaryText} />
                      <Text style={[styles.fabNoteActionText, { color: colors.text }]}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fabNoteAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={chooseExternalDeliveryNotePhoto}
                    >
                      <Ionicons name="images-outline" size={16} color={colors.primaryText} />
                      <Text style={[styles.fabNoteActionText, { color: colors.text }]}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fabNoteAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={chooseExternalDeliveryNoteFile}
                    >
                      <Ionicons name="attach-outline" size={16} color={colors.primaryText} />
                      <Text style={[styles.fabNoteActionText, { color: colors.text }]}>File</Text>
                    </TouchableOpacity>
                  </View>
                  {fabDeliveryNote ? (
                    <View style={[styles.fabSelectedNote, { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}0D` }]}>
                      {fabDeliveryNote.mimeType?.startsWith('image/') ? (
                        <Image source={{ uri: fabDeliveryNote.uri }} style={styles.fabDeliveryNotePreview} />
                      ) : (
                        <View style={[styles.fabDeliveryNotePreview, styles.fabPdfPreview, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="document-text-outline" size={22} color="#B91C1C" />
                          <Text style={styles.fabPdfPreviewText}>PDF</Text>
                        </View>
                      )}
                      <Text style={[styles.fabSelectedNoteName, { color: colors.text }]} numberOfLines={2}>{fabDeliveryNote.displayName}</Text>
                      <TouchableOpacity
                        onPress={() => setFabDeliveryNote(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove external delivery note"
                      >
                        <Ionicons name="close-circle" size={21} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}

              {fabSubmitError ? <Text style={[styles.fabSubmitError, { color: colors.danger }]}>{fabSubmitError}</Text> : null}

              <TouchableOpacity
                style={[styles.fabCreateBtn, { backgroundColor: (() => {
                  const weightInNum = parseFloat(fabWeightIn);
                  const hasValidWeight = !isNaN(weightInNum) && weightInNum > 0;
                  const hasValidDriver =  fabSelectedDriver;
                  const hasValidVehicle =  fabSelectedVehicle;
                  const bankerRequired = !isWarehouseMaterial(null, fabMaterialSource);
                  return fabSelectedPo && hasValidWeight && hasValidDriver && hasValidVehicle && fabMaterialSource.trim() && fabLotNumber.trim() && (!bankerRequired || fabBanker.trim()) && !fabSubmitting ? colors.primary : colors.border;
                })() }]}
                onPress={handleFabSubmit}
                disabled={(() => {
                  const weightInNum = parseFloat(fabWeightIn);
                  const hasValidWeight = !isNaN(weightInNum) && weightInNum > 0;
                  const hasValidDriver =  fabSelectedDriver;
                  const hasValidVehicle = fabSelectedVehicle;
                  const bankerRequired = !isWarehouseMaterial(null, fabMaterialSource);
                  return !fabSelectedPo || !hasValidWeight || !hasValidDriver || !hasValidVehicle || !fabMaterialSource.trim() || !fabLotNumber.trim() || (bankerRequired && !fabBanker.trim()) || fabSubmitting;
                })()}
              >
                {fabSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />}
                <Text style={styles.fabCreateBtnText}>{fabSubmitting ? 'Registering...' : 'Confirm & Add'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Phase 1 Success Modal ─── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.successDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.successIconWrap,
                { backgroundColor: '#10B98115' },
              ]}
            >
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Weight In Recorded
            </Text>
            <Text style={[styles.successSub, { color: colors.textMuted }]}>
              {successJob
                ? `Site Arrival Weight of ${successJob.siteWeighInWeight?.toFixed(1)}T recorded for ${successJob.jobId}.`
                : 'Site arrival weight has been recorded successfully.'}
            </Text>
            <Text style={[styles.successHint, { color: colors.textMuted }]}>
              The truck has been moved to the Weights tab for Weight Out and
              finalization.
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={[
                  styles.stayBtn,
                  { borderColor: colors.border },
                ]}
                onPress={() => setSuccessModalVisible(false)}
              >
                <Text
                  style={[
                    styles.stayBtnText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Stay Here
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.goBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={navigateToWeights}
              >
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.goBtnText}>Go to Weights</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Profile Modal */}
      <DriverProfileModal
        visible={driverProfileVisible}
        driverId={selectedDriverId}
        driverData={selectedDriverData}
        jobId={selectedDriverJobId}
        onClose={() => {
          setDriverProfileVisible(false);
          setSelectedDriverId('');
          setSelectedDriverData(null);
          setSelectedDriverJobId('');
        }}
      />

      {/* Full-Screen Photo Viewer Modal */}
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
        statusBarTranslucent={canControlStatusBarAppearance}
      >
        <View style={styles.photoViewerBackdrop}>
          <TouchableOpacity
            style={styles.photoViewerCloseBtn}
            onPress={() => setPhotoViewerVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <Image
            source={{ uri: photoViewerUri }}
            style={styles.photoViewerImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.md,paddingTop:0,
  },
  driverAvatarSmall: { width: 24, height: 24, borderRadius: 12 },
  // Card
  cardHeaderTouchable: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.xs,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobId: { fontSize: 16, fontWeight: '700' },
  poText: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs},
  quarryNetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1, marginTop: Spacing.xs,
  },
  quarryNetLabel: { fontSize: 12, fontWeight: '700' },
  quarryWeightsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: 'wrap' },
  quarryWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  quarryWeightLabel: { fontSize: 12, fontWeight: '700' },
  timestamp: { fontSize: 12, marginTop: Spacing.xs},
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full, marginTop: Spacing.xs,
  },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // Weight In Form (expanded)
  weightInSection: { marginTop: Spacing.xs,
  },
  weightInDivider: {
    height: 1, marginBottom: Spacing.xs,
  },
  weightInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1, marginBottom: Spacing.xs,
  },
  weightInStageBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInTitle: {
    fontSize: 14,
    fontWeight: '800', marginBottom: Spacing.xs,
  },
  weightInSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  weightInputContainer: {
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  weightInputField: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
  },
  weightInputSuffix: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444', marginBottom: Spacing.xs,
  },
  weightInActions: {
    flexDirection: 'row',
    gap: Spacing.sm, marginTop: Spacing.xs,
  },
  cancelWeightInBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWeightInText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmWeightInBtn: {
    flex: 2,
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  confirmWeightInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Success Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  successDialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center', marginBottom: Spacing.xs,
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18, marginBottom: Spacing.xs,
  },
  successHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16, marginBottom: Spacing.xs,
    fontStyle: 'italic',
  },
  successActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  stayBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  goBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  goBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Lot Input (scheduled weigh-in form)
  lotInputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs},
  lotInputField: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  // FAB Button
  fabBtn: { position: 'absolute', right: Spacing.xl, bottom: Spacing.xl, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  // FAB Modal
  fabModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  fabSheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, height: '90%', minHeight: 0 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: Spacing.xs},
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fabInputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  fabInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  fabOptionList: { gap: Spacing.sm },
  // Five 58px rows are visible; larger vendor fleets remain available by scrolling.
  fabSelectionList: { maxHeight: 322 },
  fabOptionRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fabOptionTitle: { fontSize: 14, fontWeight: '900' },
  fabOptionMeta: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  fabSelectedBlock: { gap: Spacing.sm },
  fabPrefillTitle: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  fabPoMaterials: { gap: 2 },
  fabLabel: { fontSize: 14, fontWeight: '900', marginTop: Spacing.xs},
  fabSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs},
  fabToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  fabToggleText: { fontSize: 11, fontWeight: '800' },
  fabDriverRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fabDriverPhoto: { width: 32, height: 32, borderRadius: 16 },
  fabSourceBlock: { gap: Spacing.sm },
  fabDropdown: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  fabDropdownItem: { minHeight: 42, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fabDropdownText: { fontSize: 14, fontWeight: '800' },
  bankerPickerBlock: { gap: 0, marginTop: Spacing.xs},
  bankerPickerText: { textAlign: 'left', transform: [{ translateY: 16 }] },
  bankerPickerSelected: { fontSize: 17, fontWeight: '900' },
  dropdownMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dropdownMetaText: { fontSize: 12, fontWeight: '700' },
  fabEmpty: { fontSize: 13, fontWeight: '700', paddingVertical: Spacing.md },
  fabDeliveryNote: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  fabDeliveryNoteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  fabNoteHelp: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs},
  fabNoteActions: { flexDirection: 'row', gap: Spacing.xs },
  fabNoteAction: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 4 },
  fabNoteActionText: { fontSize: 11, fontWeight: '800' },
  fabSelectedNote: { minHeight: 52, borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fabDeliveryNotePreview: { width: 42, height: 42, borderRadius: Radius.sm, resizeMode: 'cover' },
  fabPdfPreview: { alignItems: 'center', justifyContent: 'center' },
  fabPdfPreviewText: { color: '#B91C1C', fontSize: 9, fontWeight: '900' },
  fabSelectedNoteName: { flex: 1, fontSize: 12, fontWeight: '800' },
  fabSubmitError: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  fabCreateBtn: { minHeight: 50, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  fabCreateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  // Dispatch photo section (driver verification photo from quarry weigh-out)
  dispatchPhotoSection: { marginTop: Spacing.xs, gap: Spacing.xs },
  dispatchPhotoHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dispatchPhotoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dispatchPhotoThumb: { width: '100%', height: 160, borderRadius: Radius.md, borderWidth: 1, backgroundColor: '#F1F5F9' },
  // Full-screen photo viewer
  photoViewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
});
