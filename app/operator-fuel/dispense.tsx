import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useTheme } from "../../hooks/useTheme";
import { Gap, Radius, Spacing } from "../../constants/theme";
import {
  fetchFuelReadyDeliveryOrders,
  createFuelRecord,
  confirmFuelTransaction,
  fetchFuelRecords,
  requestFuelAuthorization,
  verifyFuelAuthorization,
} from "../../services/api";
import { normalizeJobStatus } from "../../utils/jobStatus";
import { useAuthStore } from "@/store/authStore";
import { useFuelDispenseStore } from "@/store/fuelDispenseStore";
import type { FlowStep } from "@/store/fuelDispenseStore";
import { generateFuelRecordId } from "../../utils/helpers";
import { DataCard, EmptyState, PageShell } from "../../components/EnterpriseUI";
import { uploadFuelPumpPhoto } from "../../services/uploadService";

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------
function showToast(
  type: "success" | "error" | "info",
  title: string,
  message?: string,
) {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 60,
  });
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function FuelDispenseScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const { user } = useAuthStore();

  // ---- Local state ----
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedJobSearch, setCompletedJobSearch] = useState("");

  // Fuel price from management
  const [fuelPrice, setFuelPrice] = useState<number>(0);

  // Fuel pump photo capture
  const [pumpPhotoUri, setPumpPhotoUri] = useState<string | null>(null);
  const [pumpPhotoUploading, setPumpPhotoUploading] = useState(false);
  const [pumpPhotoURL, setPumpPhotoURL] = useState<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);

  // ---- Zustand store ----
  const store = useFuelDispenseStore();

  // ============================ Data Fetching ==============================

  const loadData = useCallback(
    async (silent?: boolean) => {
      if (!silent) setRefreshing(true);
      try {
        const [deliveryData, fuelData] = await Promise.all([
          fetchFuelReadyDeliveryOrders(),
          fetchFuelRecords(),
        ]);

        setDeliveries(
          (deliveryData || []).filter(
            (d: any) => {
              const finalizedAtSite = ["SITE_WEIGHED_OUT", "COMPLETED"].includes(
                normalizeJobStatus(d.status),
              );
              const warehouse = d.isWarehouseDelivery || [d.deliveryOrigin, d.materialSource].some((value) => String(value || '').trim().toLowerCase() === 'warehouse');
              return !warehouse && finalizedAtSite;
            },
          ),
        );
        setFuelRecords(fuelData || []);
      } catch {
        // Silent fail
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [], // no external deps needed — we read store directly inside
  );

  useEffect(() => {
    const timer = setInterval(() => { void loadData(true); }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  const loadFuelPrice = async () => {
    try {
      setFuelPrice(0);
    } catch {
      setFuelPrice(0);
    }
  };

  // Restore persisted state on mount
  useEffect(() => {
    store.loadCompletedJobs();
    store.restoreState().then((restored) => {
      if (restored) {
        showToast(
          "info",
          "Session Restored",
          "Resuming fuel dispensing flow from where you left off.",
        );
      }
    });
    loadData();
    loadFuelPrice();
  }, []);

  // Persist state whenever flow state changes
  useEffect(() => {
    if (store.flowVisible) {
      store.persistState();
    }
  }, [
    store.flowVisible,
    store.flowStep,
    store.flowFuelAmount,
    store.activeJob,
    store.authId,
    store.authStatus,
    store.otpModalVisible,
  ]);

  // Keep the PIN prompt inside the fuel-flow modal. Android does not reliably
  // deliver keyboard events to a native Modal opened on top of another Modal.
  useEffect(() => {
    if (store.otpModalVisible) {
      requestAnimationFrame(() => otpInputRef.current?.focus());
    }
  }, [store.otpModalVisible]);

  // ========================= Derived Lists ================================

  const getJobFuelAmount = (jobId: string): number =>
    fuelRecords
      .filter((f) => f.jobId === jobId)
      .reduce((s, f) => s + (f.fuelAmount || 0), 0);

  // The site-out completion is the authoritative signal that a job is ready
  // for fuel. Receipt notes are generated by the site workflow, but should not
  // hide otherwise valid finalized jobs from the fuel operator.
  const completedDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const jobId = d.jobId || d.id;
      return Boolean(jobId);
    });
  }, [deliveries, store.completedJobIds, fuelRecords]);

  const filteredCompletedDeliveries = useMemo(() => {
    const query = completedJobSearch.trim().toLowerCase();
    if (!query) return completedDeliveries;
    return completedDeliveries.filter((job: any) => {
      const rn = job.receiptNoteId || job.receiptNote || "";
      return [job.jobId, job.id, rn, job.driverName, job.plateNumber, job.vendorName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [completedDeliveries, completedJobSearch]);

  // =========================== FAB Flow ===================================

  const openFlow = () => {
    setPumpPhotoUri(null);
    setPumpPhotoURL(null);
    setPumpPhotoUploading(false);
    store.openFlow();
    loadData(); // refresh completed jobs
  };

  const closeFlow = () => {
    setPumpPhotoUri(null);
    setPumpPhotoURL(null);
    setPumpPhotoUploading(false);
    store.closeFlow();
    loadData(); // refresh after close
  };

  // Select a completed job from the list
  const handleSelectJob = async (job: any) => {
    setPumpPhotoUri(null);
    setPumpPhotoURL(null);
    setPumpPhotoUploading(false);
    const jobId = job.jobId || job.id;

    store.setActiveJob(job);
    store.setFlowFuelAmount("");
    store.setFlowStep("authorization");
  };

  // Request authorization from vendor
  const handleRequestAuthorization = async () => {
    if (!store.activeJob) {
      showToast(
        "error",
        "No Job Selected",
        "Please select a completed job first.",
      );
      return;
    }

    const vendorPhone =
      store.activeJob.vendorPhone ||
      store.activeJob.vendorMobile ||
      store.activeJob.vendorContactPhone ||
      "";
    const driverPhone = store.activeJob.driverPhone || "";

    if (!vendorPhone) {
      showToast(
        "error",
        "Missing Vendor Phone",
        "Add a phone number to this job's vendor before requesting an Authorization PIN.",
      );
      return;
    }

    store.setSubmitting(true);
    try {
      const result = await requestFuelAuthorization({
        vendorId: store.activeJob.vendorId,
        vendorName: store.activeJob.vendorName || "Unknown Vendor",
        vendorPhone,
        driverId: store.activeJob.driverId,
        driverCode:
          store.activeJob.baseDriverCode ||
          store.activeJob.driverCode ||
          store.activeJob.driverCodeId ||
          store.activeJob.driverId ||
          "",
        driverName: store.activeJob.driverName || "Unknown Driver",
        driverPhone,
        vehicleId: store.activeJob.vehicleId || store.activeJob.id,
        plateNumber: store.activeJob.plateNumber || "N/A",
        fuelAmount: 0,
        jobId: store.activeJob.jobId || store.activeJob.id,
      });

      if (!result?.id) {
        throw new Error(
          "Authorization request was not created. Please try again.",
        );
      }

      store.setAuthId(result.id);
      store.setAuthStatus("pending");
      store.setOtpInput("");
      store.setOtpModalVisible(true);

      showToast(
        "success",
        "Authorization Requested",
        "An authorization PIN has been sent to the vendor.",
      );
    } catch (error: any) {
      const message =
        error?.message || "Failed to request authorization. Please try again.";
      showToast("error", "Authorization Failed", message);
    } finally {
      store.setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = store.otpInput.trim();
    if (!store.authId) {
      showToast(
        "error",
        "No Authorization",
        "No active authorization request.",
      );
      return;
    }
    if (!code) {
      showToast(
        "error",
        "Missing PIN",
        "Enter the Authorization PIN sent to the vendor.",
      );
      return;
    }
    if (code.length < 4) {
      showToast(
        "error",
        "Invalid PIN",
        "Please enter the full Authorization PIN code.",
      );
      return;
    }

    store.setAuthVerifying(true);
    try {
      const result = await verifyFuelAuthorization(store.authId, code, true);
      if (result?.authorized !== true && result?.status !== "authorized") {
        throw new Error(
          result?.message || "Authorization PIN verification failed.",
        );
      }

      // Auth PIN is the PIN sent to and entered by the vendor.
      store.setAuthCode(code);
      // The attendant should only see the three-digit suffix to append.
      // Keep the full GIR active code out of the operator-facing UI.
      const appendedCode = String(result?.fuelCode || result?.girDriverCode || '').slice(-3);
      store.setGirDriverCode(appendedCode || null);
      store.setAuthStatus("authorized");
      store.setOtpModalVisible(false);
      store.setOtpInput("");

      showToast(
        "success",
        "Authorized",
        "Authorization PIN verified. You can now dispense fuel.",
      );

      // Auto-advance to form step
      // Advance only after the successful response has been applied.
      store.setFlowStep("form");
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Invalid Authorization PIN. Please try again.";

      // Check if the error indicates an expired OTP
      if (
        message.toLowerCase().includes("expired") ||
        message.toLowerCase().includes("timeout")
      ) {
        store.setAuthStatus("expired");
        showToast(
          "error",
          "PIN Expired",
          "The authorization PIN has expired. Please request a new one.",
        );
      } else {
        showToast("error", "Verification Failed", message);
      }
    } finally {
      store.setAuthVerifying(false);
    }
  };

  const handleTakePumpPhoto = async () => {
    if (!store.activeJob) {
      showToast("error", "No Job", "Select a job before capturing the pump photo.");
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Camera access is required to capture the pump photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;
      const jobId = store.activeJob.jobId || store.activeJob.id;
      setPumpPhotoUri(fileUri);
      setPumpPhotoUploading(true);
      try {
        const uploadResult = await uploadFuelPumpPhoto(jobId, fileUri);
        if (uploadResult.success && uploadResult.photoURL) {
          setPumpPhotoURL(uploadResult.photoURL);
          setPumpPhotoUri(null);
          showToast("success", "Pump Photo Captured", "Fuel pump photo uploaded successfully.");
        } else {
          throw new Error("Pump photo upload did not return a valid image URL.");
        }
      } catch (error: any) {
        setPumpPhotoUri(null);
        throw error;
      }
    } catch (error: any) {
      Alert.alert("Photo Upload Failed", error?.message || "Could not capture the fuel pump photo.");
    } finally {
      setPumpPhotoUploading(false);
    }
  };

  const [confirmedFuel, setConfirmedFuel] = useState<{id: string; volume: number; authorizationId: string} | null>(null);
  const fuelSubmitLock = useRef(false);
  useEffect(() => { setConfirmedFuel(null); }, [store.authId, store.activeJob?.id]);

  // Confirm the actual FMS volume before recording the receipt.
  const handleFlowSubmit = async () => {
    if (fuelSubmitLock.current) return;
    const amount = confirmedFuel?.authorizationId === store.authId ? confirmedFuel.volume : 0;
    if (!store.activeJob) {
      showToast("error", "No Job", "No completed job selected.");
      return;
    }
    if (store.authStatus !== "authorized") {
      showToast(
        "error",
        "Not Authorized",
        "Vendor authorization is required before dispensing fuel.",
      );
      return;
    }
    if (!confirmedFuel || confirmedFuel.authorizationId !== store.authId) {
      fuelSubmitLock.current = true;
      store.setSubmitting(true);
      try {
        const authorizationId = store.authId;
        if (!authorizationId) throw new Error('Authorization is required.');
        const transaction = await confirmFuelTransaction(authorizationId, {
          jobId: store.activeJob.jobId || store.activeJob.id,
          driverId: store.activeJob.driverId,
          vehicleId: store.activeJob.vehicleId,
          vendorId: store.activeJob.vendorId,
        });
        if (useFuelDispenseStore.getState().authId !== authorizationId) return;
        if (transaction.status === 'pending') {
          showToast('info', 'Waiting for fuel transaction', 'Complete dispensing at the pump, then tap Confirm Fuel again to retrieve the volume.');
          return;
        }
        setConfirmedFuel({ ...transaction, authorizationId });
        store.setGirFuelAmount(transaction.volume);
      } catch (error: any) {
        showToast('error', 'Fuel not confirmed', error?.message || 'Could not confirm the FMS transaction.');
      } finally {
        fuelSubmitLock.current = false;
        store.setSubmitting(false);
      }
      return;
    }
    if (!pumpPhotoURL) {
      showToast(
        "error",
        "Pump Photo Required",
        "Capture a fuel pump photo before dispensing fuel.",
      );
      return;
    }

    const jobId = store.activeJob.jobId || store.activeJob.id;

    fuelSubmitLock.current = true;
    store.setSubmitting(true);
    try {
      const fuelId = generateFuelRecordId();

      // Create the fuel record
      const createdFuel = await createFuelRecord({
        fuelId,
        fmsTransactionId: confirmedFuel.id,
        vehicleId: store.activeJob.vehicleId,
        jobId,
        deliveryOrderId: store.activeJob.id,
        driverId: store.activeJob.driverId,
        driverName: store.activeJob.driverName || "N/A",
        plateNumber: store.activeJob.plateNumber || "N/A",
        vendorId: store.activeJob.vendorId,
        vendorName: store.activeJob.vendorName || "N/A",
        companyName: store.activeJob.companyName || store.activeJob.vendorName || "N/A",
        materialName: store.activeJob.materialName || "N/A",
        fuelAmount: amount,
        pricePerLiter: fuelPrice,
        totalCost: fuelPrice > 0 ? amount * fuelPrice : 0,
        unit: "Litres",
        dispensedBy: user?.email || "Fuel Operator",
        dispensedByEmail: user?.email || "",
        dispensedByName: user?.displayName || user?.name || "Fuel Operator",
        dispensedAt: new Date().toISOString(),
        authorizationId: store.authId,
        authorizationCode: store.authCode,
        otp: store.girDriverCode || store.authCode,
        pumpPhotoURL,
      });
      const girVolume = Number(createdFuel?.fuelAmount ?? createdFuel?.quantity ?? createdFuel?.litres);
      store.setGirFuelAmount(Number.isFinite(girVolume) && girVolume > 0 ? girVolume : null);

      // A fuel record is the source of truth for completed dispensing. The
      // legacy delivery-order `/fueled` endpoint is not available to the fuel
      // operator and would report a false 403 after a successful fuel record.
      store.markJobCompleted(jobId);

      showToast(
        "success",
        "Fuel Dispensed",
        `${girVolume.toFixed(1)} litres recorded as ${createdFuel.id || fuelId}. Job card removed from completed jobs.`,
      );

      setPumpPhotoUri(null);
      setPumpPhotoURL(null);
      setPumpPhotoUploading(false);

      // Close the flow and refresh data
      store.closeFlow();
      loadData();
      Alert.alert('Fuel receipt ready', `${girVolume.toFixed(1)} litres recorded. Receipt: ${createdFuel.id}`, [
        { text: 'Done' },
        { text: 'View receipts', onPress: () => router.push('/operator-fuel/history' as any) },
      ]);
    } catch (error: any) {
      const message =
        error?.message || "Failed to record fuel. Please try again.";
      showToast("error", "Dispense Failed", message);
    } finally {
      fuelSubmitLock.current = false;
      store.setSubmitting(false);
    }
  };

  // Driver photo URL helper
  const getDriverPhotoUrl = (driver: any): string | undefined => {
    return (
      driver?.photoURL ||
      driver?.profilePicture ||
      driver?.photoUrl ||
      undefined
    );
  };

  // ======================== Render: Main Screen ============================

  return (
    <View style={{ flex: 1 }}>
      <PageShell
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={{ color: colors.textMuted }}>
          Press the + button to select a completed job and dispense fuel
        </Text>

        {loading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>
              Loading...
            </Text>
          </DataCard>
        ) : completedDeliveries.length ? (
          <DataCard>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Gap,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={colors.warningText}
              />
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
              >
                {completedDeliveries.length} completed job
                {completedDeliveries.length !== 1 ? "s" : ""} available
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: Spacing.xs}}
            >
              Tap the + button to view and dispense fuel
            </Text>
          </DataCard>
        ) : (
          <EmptyState
            icon="water-outline"
            title="No completed jobs"
            subtitle="No completed delivery orders available for fuel dispensing."
          />
        )}
      </PageShell>

      {/* FAB Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openFlow}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </TouchableOpacity>

      {/* Flow Modal */}
      <Modal
        visible={store.flowVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() =>
          store.otpModalVisible
            ? store.setOtpModalVisible(false)
            : closeFlow()
        }
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.flowSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* Header */}
            <View style={styles.flowHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {store.flowStep === "list"
                    ? "Completed Jobs"
                    : store.flowStep === "authorization"
                      ? "Vendor Authorization"
                      : confirmedFuel ? "Step 3: Finalize Fuel" : "Step 2: Confirm Dispensed Fuel"}
                </Text>
                <Text
                  style={[styles.sheetSub, { color: colors.textMuted }]}
                  numberOfLines={2}
                >
                  {store.flowStep === "list"
                    ? "Select a completed job to dispense fuel"
                    : store.flowStep === "authorization"
                      ? `Job: ${store.activeJob?.jobId || store.activeJob?.id || "N/A"}`
                      : `Job: ${store.activeJob?.jobId || store.activeJob?.id || "N/A"}  ·  Driver: ${store.activeJob?.driverName || "N/A"}  ·  Truck: ${store.activeJob?.plateNumber || "N/A"}`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
                onPress={closeFlow}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Step indicators */}
            <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
              1. Vendor authorization → 2. Confirm dispensed volume → 3. Finalize fuel transaction
            </Text>
            <View style={styles.stepRow}>
              {(["list", "authorization", "form"] as FlowStep[]).map(
                (s, idx) => {
                  const steps: FlowStep[] = ["list", "authorization", "form"];
                  const currentIdx = steps.indexOf(store.flowStep);
                  const stepIdx = steps.indexOf(s);
                  const completed = stepIdx < currentIdx;
                  const isCurrent = stepIdx === currentIdx;
                  let dotColor = colors.border;
                  if (completed) dotColor = colors.success;
                  else if (isCurrent) dotColor = colors.warningText;
                  let lineColor = colors.border;
                  if (stepIdx < 2 && stepIdx < currentIdx)
                    lineColor = colors.success;
                  return (
                    <React.Fragment key={s}>
                      <View
                        style={[styles.stepDot, { backgroundColor: dotColor }]}
                      />
                      {stepIdx < 2 && (
                        <View
                          style={[
                            styles.stepLine,
                            { backgroundColor: lineColor },
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                },
              )}
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1, minHeight: 0 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
            >
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Gap, paddingBottom: Spacing.xl }}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              nestedScrollEnabled
            >
              {/* ============ STEP 1: Completed Jobs List ============ */}
              {store.flowStep === "list" && (
                <>
                  <View style={{ marginBottom: Spacing.xs }}>
                    <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
                      value={completedJobSearch}
                      onChangeText={setCompletedJobSearch}
                      placeholder="Search job, RN, driver, truck or vendor"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                  </View>
                  {filteredCompletedDeliveries.length ? (
                    filteredCompletedDeliveries.map((job) => {
                      const jobId = job.jobId || job.id;
                      const existingFuel = 0;
                      const isCompleted = false;
                      return (
                        <TouchableOpacity
                          key={job.id}
                          style={[
                            styles.jobSelectCard,
                            {
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={() => {
                            if (!isCompleted) handleSelectJob(job);
                          }}
                          activeOpacity={isCompleted ? 1 : 0.7}
                          disabled={isCompleted}
                        >
                          <View
                            style={[
                              styles.selectIconCircle,
                              {
                                backgroundColor: isCompleted
                                  ? `${colors.success}15`
                                  : `${colors.warningText}15`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                isCompleted
                                  ? "checkmark-circle"
                                  : "document-text-outline"
                              }
                              size={20}
                              color={isCompleted ? colors.success : colors.warningText}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.selectTitle,
                                { color: colors.text },
                              ]}
                            >
                              {job.jobId || job.id}
                            </Text>
                            <Text
                              style={[
                                styles.selectSub,
                                { color: colors.textMuted },
                              ]}
                            >
                              Driver: {job.driverName || "N/A"} ·{" "}
                              {job.plateNumber || "N/A"}
                            </Text>
                            <Text
                              style={[
                                styles.selectSub,
                                { color: colors.textMuted },
                              ]}
                            >
                              Vendor: {job.vendorName || "N/A"}
                            </Text>
                            {(() => {
                              const rn =
                                job.receiptNoteId ||
                                job.receiptNote ||
                                (String(job.jobId || job.id).includes("/RN")
                                  ? String(job.jobId || job.id)
                                  : null);
                              return rn ? (
                                <Text
                                  style={[
                                    styles.selectSub,
                                    {
                                      color: colors.success,
                                      fontWeight: "600", marginTop: Spacing.xs,
                                    },
                                  ]}
                                >
                                  RN: {rn}
                                </Text>
                              ) : null;
                            })()}
                            {existingFuel > 0 && (
                              <View
                                style={[
                                  styles.fuelChip,
                                  {
                                    backgroundColor: `${colors.warning}10`,
                                    borderColor: `${colors.warningBorder}30`,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="water"
                                  size={12}
                                  color={colors.warningText}
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.warningText,
                                  }}
                                >
                                  {existingFuel.toFixed(1)} L already dispensed
                                </Text>
                              </View>
                            )}
                            {isCompleted && (
                              <View
                                style={[
                                  styles.fuelChip,
                                  {
                                    backgroundColor: `${colors.success}15`,
                                    borderColor: `${colors.successBorder}30`,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color={colors.success}
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.success,
                                  }}
                                >
                                  Fueled ✓
                                </Text>
                              </View>
                            )}
                          </View>
                          {!isCompleted && (
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={colors.textTertiary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <EmptyState
                      icon="document-text-outline"
                      title="No completed jobs"
                      subtitle="No completed delivery orders available for fuel dispensing."
                    />
                  )}
                </>
              )}

              {/* ============ STEP 2: Authorization ============ */}
              {store.flowStep === "authorization" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Gap,
                    }}
                  >
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => {
                        store.setFlowStep("list");
                        store.setOtpModalVisible(false);
                        store.setOtpInput("");
                      }}
                    >
                      <Ionicons
                        name="arrow-back"
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.backText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Back
                      </Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: `${colors.warning}15`,
                          borderColor: `${colors.warningBorder}30`,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.warningText,
                        }}
                      >
                        {store.activeJob?.jobId || store.activeJob?.id || "Job"}
                      </Text>
                    </View>
                  </View>

                  {/* Selected job summary */}
                  {store.activeJob && (
                    <View
                      style={[
                        styles.jobSummaryCard,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: Gap,
                        }}
                      >
                        {getDriverPhotoUrl(store.activeJob) ? (
                          <Image
                            source={{
                              uri: getDriverPhotoUrl(store.activeJob),
                            }}
                            style={styles.driverPhotoLarge}
                          />
                        ) : (
                          <View
                            style={[
                              styles.driverPhotoLarge,
                              {
                                backgroundColor: `${colors.primary}15`,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons name="person" size={32} color={colors.infoText} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.selectTitle, { color: colors.text }]}
                          >
                            {store.activeJob.driverName || "Unknown Driver"}
                          </Text>
                          <Text
                            style={[
                              styles.selectSub,
                              { color: colors.textMuted },
                            ]}
                          >
                            {store.activeJob.plateNumber || "N/A"}
                          </Text>
                          <Text
                            style={[
                              styles.selectSub,
                              { color: colors.textMuted },
                            ]}
                          >
                            {store.activeJob.vendorName || "Unknown Vendor"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Authorization status display */}
                  <View
                    style={[
                      styles.authStatusCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        gap: Gap,
                        paddingVertical: Spacing.xl,
                      }}
                    >
                      {store.authStatus === "pending" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: `${colors.warning}15` },
                            ]}
                          >
                            <Ionicons
                              name="key-outline"
                              size={48}
                              color={colors.warningText}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: colors.text,
                              textAlign: "center",
                            }}
                          >
                            Request Vendor Authorization
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: colors.textMuted,
                              textAlign: "center",
                            }}
                          >
                            Send an Authorization request to the linked vendor,
                            then enter the code here to verify fuel dispensing.
                          </Text>
                          {store.authId ? (
                            <TouchableOpacity
                              style={[
                                styles.submitBtn,
                                { backgroundColor: colors.warning },
                              ]}
                              onPress={() => store.setOtpModalVisible(true)}
                            >
                              <Ionicons
                                name="keypad-outline"
                                size={20}
                                color={colors.onPrimary}
                              />
                              <Text style={styles.submitBtnText}>
                                Enter Authorization Pin
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      ) : store.authStatus === "authorized" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: `${colors.success}15` },
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={48}
                              color={colors.success}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: colors.success,
                              textAlign: "center",
                            }}
                          >
                            Authorized!
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: colors.textMuted,
                              textAlign: "center",
                            }}
                          >
                            The vendor has authorized fuel dispensing. Share the temporary code below with the driver, then proceed. GIR/FMS will provide the fuel volume.
                          </Text>
                          {store.girDriverCode ? <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textMuted, textAlign: "center", marginTop: 12 }}>APPEND CODE</Text> : null}
                          {store.girDriverCode ? <Text style={{ fontSize: 30, fontWeight: "900", letterSpacing: 5, color: colors.infoText, textAlign: "center", marginVertical: 8 }}>{store.girDriverCode}</Text> : null}
                          <TouchableOpacity
                            style={[
                              styles.submitBtn,
                              { backgroundColor: colors.success },
                            ]}
                            onPress={() => store.setFlowStep("form")}
                          >
                            <Ionicons
                              name="water-outline"
                              size={20}
                              color={colors.onPrimary}
                            />
                            <Text style={styles.submitBtnText}>
                              Proceed to Fueling
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : store.authStatus === "denied" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: `${colors.danger}15` },
                            ]}
                          >
                            <Ionicons
                              name="close-circle"
                              size={48}
                              color={colors.danger}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: colors.danger,
                              textAlign: "center",
                            }}
                          >
                            Authorization Denied
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: colors.textMuted,
                              textAlign: "center",
                            }}
                          >
                            The vendor has denied this fuel dispensing request.
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.submitBtn,
                              { backgroundColor: colors.primary },
                            ]}
                            onPress={() => {
                              store.setAuthId(null);
                              store.setAuthStatus("pending");
                              store.setFlowStep("list");
                            }}
                          >
                            <Ionicons
                              name="arrow-back"
                              size={20}
                              color={colors.onPrimary}
                            />
                            <Text style={styles.submitBtnText}>
                              Back to Jobs
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : store.authStatus === "expired" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: "#94A3B815" },
                            ]}
                          >
                            <Ionicons
                              name="time-outline"
                              size={48}
                              color={colors.textMuted}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: colors.textMuted,
                              textAlign: "center",
                            }}
                          >
                            Authorization PIN Expired
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: colors.textMuted,
                              textAlign: "center",
                            }}
                          >
                            The authorization PIN has expired. Please select a
                            job and request a new authorization.
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.submitBtn,
                              { backgroundColor: colors.primary },
                            ]}
                            onPress={() => {
                              store.setAuthId(null);
                              store.setAuthStatus("pending");
                              store.setFlowStep("list");
                            }}
                          >
                            <Ionicons
                              name="refresh"
                              size={20}
                              color={colors.onPrimary}
                            />
                            <Text style={styles.submitBtnText}>
                              Back to Jobs
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : null}

                      {/* Initial request button (only when not yet requested) */}
                      {!store.authId && store.authStatus === "pending" && (
                        <TouchableOpacity
                          style={[
                            styles.submitBtn,
                            { backgroundColor: colors.primary },
                          ]}
                          onPress={handleRequestAuthorization}
                          disabled={store.submitting}
                        >
                          {store.submitting ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                          ) : (
                            <Ionicons
                              name="key-outline"
                              size={20}
                              color={colors.onPrimary}
                            />
                          )}
                          <Text style={styles.submitBtnText}>
                            {store.submitting
                              ? "Requesting..."
                              : "Request Authorization"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* ============ STEP 3: Fuel Amount Form ============ */}
              {store.flowStep === "form" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Gap,
                      flexWrap: "wrap",
                    }}
                  >
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => store.setFlowStep("authorization")}
                    >
                      <Ionicons
                        name="arrow-back"
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.backText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Back
                      </Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: `${colors.success}15`,
                          borderColor: `${colors.successBorder}30`,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.success,
                        }}
                      >
                        Authorized ✓
                      </Text>
                    </View>
                  </View>

                  {/* Driver info card */}
                  {store.activeJob && (
                    <View
                      style={[
                        styles.driverInfoCard,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: Gap,
                        }}
                      >
                        {getDriverPhotoUrl(store.activeJob) ? (
                          <Image
                            source={{
                              uri: getDriverPhotoUrl(store.activeJob),
                            }}
                            style={styles.driverPhotoLarge}
                          />
                        ) : (
                          <View
                            style={[
                              styles.driverPhotoLarge,
                              {
                                backgroundColor: `${colors.primary}15`,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons name="person" size={32} color={colors.infoText} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.selectTitle, { color: colors.text }]}
                          >
                            {store.activeJob.driverName || "Unknown Driver"}
                          </Text>
                          <Text
                            style={[
                              styles.selectSub,
                              { color: colors.textMuted },
                            ]}
                          >
                            ID: {store.activeJob.driverId} ·{" "}
                            {store.activeJob.plateNumber || "N/A"}
                          </Text>
                          <Text
                            style={[
                              styles.selectSub,
                              { color: colors.textMuted },
                            ]}
                          >
                            Job: {store.activeJob.jobId || store.activeJob.id}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {false && <>
                  {/* Fuel amount input */}
                  <View
                    style={[
                      styles.inputCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.inputHeader}>
                      <View
                        style={[
                          styles.inputIcon,
                          { backgroundColor: `${colors.warning}15` },
                        ]}
                      >
                        <Ionicons
                          name="water-outline"
                          size={22}
                          color={colors.warningText}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.inputTitle, { color: colors.text }]}
                        >
                          Fuel Amount
                        </Text>
                        <Text
                          style={[styles.inputSub, { color: colors.textMuted }]}
                        >
                          Enter fuel amount in litres.
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.fuelInputWrap,
                        {
                          borderColor: colors.warningBorder,
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
                        style={[styles.fuelInput, { color: colors.text }]}
                        placeholder="0.0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={store.flowFuelAmount}
                        onChangeText={store.setFlowFuelAmount}
                        autoFocus
                      />
                      <Text
                        style={[styles.fuelSuffix, { color: colors.textMuted }]}
                      >
                        Litres
                      </Text>
                    </View>
                  </View>

                  </>}

                  {/* Fuel volume is supplied by GIR/FMS after dispensing. */}
                  {store.flowFuelAmount && fuelPrice > 0 ? (
                    <View
                      style={{ marginTop: Spacing.xs,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Gap,
                        paddingHorizontal: Spacing.sm,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: colors.textMuted,
                        }}
                      >
                        Total Cost:
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: colors.success,
                        }}
                      >
                        KES{" "}
                        {(
                          parseFloat(store.flowFuelAmount) * fuelPrice
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  ) : null}

                  {/* GIR/FMS driver code — keep immediately above the evidence photo. */}
                  {store.girDriverCode || store.girFuelAmount != null ? (
                    <View
                      style={{
                        marginBottom: Spacing.md,
                        padding: Spacing.md,
                        borderRadius: Radius.lg,
                        borderWidth: 2,
                        borderColor: colors.infoBorder,
                        backgroundColor: `${colors.primary}10`,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                        APPEND CODE — SHARE WITH DRIVER
                      </Text>
                      <Text style={{ color: colors.infoText, fontSize: 32, fontWeight: '900', letterSpacing: 6, marginTop: 4 }}>
                        {store.girDriverCode}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        Enter/share this appended code with the driver
                      </Text>
                      {store.girFuelAmount != null ? (
                        <View style={{ alignItems: 'center', marginTop: Spacing.sm }}>
                          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                            GIR/FMS FUEL VOLUME
                          </Text>
                          <Text style={{ color: colors.success, fontSize: 22, fontWeight: '900', marginTop: 2 }}>
                            {store.girFuelAmount.toFixed(1)} L
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Pump photo capture */}
                  <View
                    style={[
                      styles.inputCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.inputHeader}>
                      <View
                        style={[
                          styles.inputIcon,
                          { backgroundColor: `${colors.success}15` },
                        ]}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={22}
                          color={colors.success}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputTitle, { color: colors.text }]}>Fuel Pump Photo</Text>
                        <Text style={[styles.inputSub, { color: colors.textMuted }]}>Capture the pump photo before dispensing.</Text>
                      </View>
                    </View>

                    {(pumpPhotoURL || pumpPhotoUri) ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image
                          source={{ uri: pumpPhotoUri || pumpPhotoURL || "" }}
                          style={styles.photoPreview}
                          resizeMode="cover"
                        />
                        {pumpPhotoUploading && (
                          <View style={styles.photoOverlay}>
                            <ActivityIndicator size="large" color={colors.onPrimary} />
                            <Text style={styles.photoOverlayText}>Uploading...</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.photoPreviewWrap, styles.photoPlaceholder]}>
                        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
                        <Text style={styles.photoPlaceholderText}>No photo captured</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.submitBtn,
                        {
                          backgroundColor: pumpPhotoURL ? colors.success : colors.infoText,
                          opacity: pumpPhotoUploading ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleTakePumpPhoto}
                      disabled={pumpPhotoUploading}
                    >
                      {pumpPhotoUploading ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                      ) : (
                        <Ionicons
                          name="camera-outline"
                          size={20}
                          color={colors.onPrimary}
                        />
                      )}
                      <Text style={styles.submitBtnText}>
                        {pumpPhotoUploading ? "Uploading..." : pumpPhotoURL ? "Retake Pump Photo" : "Capture Pump Photo"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Existing fuel dispensed for this job */}
                  {store.activeJob &&
                    (() => {
                      const existingFuel = getJobFuelAmount(
                        store.activeJob.jobId || store.activeJob.id,
                      );
                      return existingFuel > 0 ? (
                        <View
                          style={[
                            styles.existingFuel,
                            {
                              backgroundColor: `${colors.warning}10`,
                              borderColor: `${colors.warningBorder}30`,
                            },
                          ]}
                        >
                          <Ionicons name="water" size={14} color={colors.warningText} />
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.warningText,
                            }}
                          >
                            {existingFuel.toFixed(1)} L already dispensed for
                            this job
                          </Text>
                        </View>
                      ) : null;
                    })()}

                  {/* Confirm / Complete button */}
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      {
                        backgroundColor: colors.warning,
                        opacity: store.submitting ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleFlowSubmit}
                    disabled={store.submitting}
                  >
                    {store.submitting ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color={colors.onPrimary}
                      />
                    )}
                    <Text style={styles.submitBtnText}>
                      {store.submitting ? "Processing..." : confirmedFuel?.authorizationId === store.authId ? "Finalize fuel & receipt" : "Confirm Fuel"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
            </KeyboardAvoidingView>
          </View>

            {store.otpModalVisible && (
              <KeyboardAvoidingView
                style={styles.otpKeyboardAvoider}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
              >
                <View style={styles.otpBackdrop}>
                  <View
                    style={[
                      styles.otpSheet,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
            <View style={styles.otpHead}>
              <Text style={[styles.otpTitle, { color: colors.text }]}>
                Enter Authorization PIN
              </Text>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
                onPress={() => store.setOtpModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center", marginBottom: Spacing.xs,
              }}
            >
              Enter the Authorization PIN sent to the vendor's phone.
            </Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => otpInputRef.current?.focus()}
              style={[
                styles.otpInputWrap,
                {
                  borderColor: colors.warningBorder,
                  backgroundColor: colors.inputBg,
                },
              ]}
            >
              <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
                ref={otpInputRef}
                style={[styles.otpInput, { color: colors.text }]}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={store.otpInput}
                onChangeText={(value) =>
                  store.setOtpInput(value.replace(/\D/g, "").slice(0, 8))
                }
                maxLength={8}
                autoFocus
              />
            </TouchableOpacity>

            <View style={styles.otpActions}>
              <TouchableOpacity
                style={[
                  styles.otpBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => { setCompletedJobSearch(""); (() => store.setOtpModalVisible(false))(); }}
              >
                <Text
                  style={[styles.otpBtnText, { color: colors.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.otpBtn, { backgroundColor: colors.warning }]}
                onPress={handleVerifyOtp}
                disabled={store.authVerifying}
              >
                {store.authVerifying ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.otpBtnText, { color: colors.onPrimary }]}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>
            </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}
        </View>
      </Modal>
    </View>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },

  // Flow sheet
  flowSheet: {
    height: "82%",
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },

  flowHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Gap, marginBottom: Spacing.xs,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  sheetSub: {
    fontSize: 13, marginTop: Spacing.xs,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Step indicators
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },

  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  stepLine: {
    flex: 1,
    height: 3,
    marginHorizontal: 4,
    borderRadius: 2,
  },

  // Job select card
  searchInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },

  jobSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  selectIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  selectTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  selectSub: {
    fontSize: 12, marginTop: Spacing.xs,
  },

  fuelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1, marginTop: Spacing.xs,
    alignSelf: "flex-start",
  },

  // Back button
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  backText: {
    fontSize: 13,
    fontWeight: "600",
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },

  // Job summary card
  jobSummaryCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  driverPhotoLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  // Auth status card
  authStatusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  authIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Gap,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    minWidth: 200,
  },

  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onPrimary,
  },

  // Driver info card
  driverInfoCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  // Input card
  inputCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },

  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap, marginBottom: Spacing.xs,
  },

  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  inputTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  inputSub: {
    fontSize: 12, marginTop: Spacing.xs,
  },

  fuelInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
  },

  fuelInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    paddingVertical: 12,
  },

  fuelSuffix: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },

  existingFuel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Gap,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  photoPreviewWrap: {
    borderRadius: Radius.md,
    overflow: "hidden", marginBottom: Spacing.xs,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  photoPreview: {
    width: "100%",
    height: 180,
  },

  photoPlaceholder: {
    backgroundColor: colors.surface,
  },

  photoPlaceholderText: {
    fontSize: 13,
    color: colors.textTertiary, marginTop: Spacing.xs,
  },

  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: Gap,
  },

  photoOverlayText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  // OTP Modal
  otpKeyboardAvoider: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    elevation: 0,
  },

  otpBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },

  otpSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },

  otpHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", marginBottom: Spacing.xs,
  },

  otpTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  otpInputWrap: {
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.xs,
  },

  otpInput: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: 12,
  },

  otpActions: {
    flexDirection: "row",
    gap: Gap,
  },

  otpBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },

  otpBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
