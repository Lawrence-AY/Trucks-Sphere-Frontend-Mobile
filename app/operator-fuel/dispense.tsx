import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useTheme } from "../../hooks/useTheme";
import { Radius, Spacing } from "../../constants/theme";
import {
  fetchDeliveryOrders,
  createFuelRecord,
  fetchFuelRecords,
  fetchVendors,
  requestFuelAuthorization,
  verifyFuelAuthorization,
  markJobAsFueled,
  checkJobFuelStatus,
} from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useFuelDispenseStore } from "../../store/fuelDispenseStore";
import type { FlowStep } from "../../store/fuelDispenseStore";
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
  const { user } = useAuthStore();

  // ---- Local state ----
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fuel price from management
  const [fuelPrice, setFuelPrice] = useState<number>(0);

  // Vendors lookup for phone numbers
  const [vendorsMap, setVendorsMap] = useState<Record<string, any>>({});

  // Fuel pump photo capture
  const [pumpPhotoUri, setPumpPhotoUri] = useState<string | null>(null);
  const [pumpPhotoUploading, setPumpPhotoUploading] = useState(false);
  const [pumpPhotoURL, setPumpPhotoURL] = useState<string | null>(null);

  // ---- Zustand store ----
  const store = useFuelDispenseStore();

  // ============================ Data Fetching ==============================

  const loadData = useCallback(
    async (silent?: boolean) => {
      if (!silent) setRefreshing(true);
      try {
        const [deliveryData, fuelData, vendorData] = await Promise.all([
          fetchDeliveryOrders(),
          fetchFuelRecords(),
          fetchVendors(),
        ]);

        // Read completedJobIds directly from store to avoid stale closure
        const completedIds = useFuelDispenseStore.getState().completedJobIds;
        setDeliveries(
          (deliveryData || []).filter(
            (d: any) =>
              ["completed", "delivered"].includes(d.status) &&
              !completedIds.includes(d.jobId || d.id),
          ),
        );
        setFuelRecords(fuelData || []);

        // Build vendors lookup map
        const map: Record<string, any> = {};
        (vendorData || []).forEach((v: any) => {
          if (v.id) map[v.id] = v;
          if (v.vendorId) map[v.vendorId] = v;
        });
        setVendorsMap(map);
      } catch {
        // Silent fail
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [], // no external deps needed — we read store directly inside
  );

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

  // ========================= Derived Lists ================================

  const getJobFuelAmount = (jobId: string): number =>
    fuelRecords
      .filter((f) => f.jobId === jobId)
      .reduce((s, f) => s + (f.fuelAmount || 0), 0);

  // Show only completed jobs (have /RN receipt note) that are not yet fueled
  const completedDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const jobId = d.jobId || d.id;
      const hasReceiptNote = Boolean(
        d.receiptNoteId || d.receiptNote || String(jobId).includes("/RN"),
      );
      const hasExistingFuel = getJobFuelAmount(jobId) > 0;
      return (
        hasReceiptNote &&
        !store.isJobCompleted(jobId) &&
        !hasExistingFuel
      );
    });
  }, [deliveries, store.completedJobIds, fuelRecords]);

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

    // Double-check if job has already been fueled (backend check)
    try {
      const status = await checkJobFuelStatus(jobId);
      if (status.fueled) {
        showToast(
          "error",
          "Already Fueled",
          `Job ${jobId} has already been fueled. Select a different job.`,
        );
        store.markJobCompleted(jobId);
        loadData();
        return;
      }
    } catch {
      // If backend check fails, allow the flow to continue
      // The local completedJobIds check will still prevent double-dispensing
    }

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

    const vendor = vendorsMap[store.activeJob.vendorId];
    const vendorPhone =
      vendor?.phone || vendor?.mobile || store.activeJob.vendorPhone || "";
    const driverPhone = store.activeJob.driverPhone || "";

    if (!vendorPhone) {
      showToast(
        "error",
        "Missing Vendor Phone",
        "This job does not have a linked vendor phone number for the Authorization PIN.",
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
      if (result?.status !== "authorized" && result?.authorized !== true) {
        throw new Error(
          result?.message || "Authorization PIN verification failed.",
        );
      }

      store.setAuthCode(code);
      store.setAuthStatus("authorized");
      store.setOtpModalVisible(false);
      store.setOtpInput("");

      showToast(
        "success",
        "Authorized",
        "Authorization PIN verified. You can now dispense fuel.",
      );

      // Auto-advance to form step
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
      console.error("[fuel] handleTakePumpPhoto error:", error?.message, error?.stack);
      Alert.alert("Photo Upload Failed", error?.message || "Could not capture the fuel pump photo.");
    } finally {
      setPumpPhotoUploading(false);
    }
  };

  // After authorization, enter fuel amount and dispense
  const handleFlowSubmit = async () => {
    const amount = parseFloat(store.flowFuelAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("error", "Invalid Amount", "Please enter a valid fuel amount.");
      return;
    }
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
    if (!pumpPhotoURL) {
      showToast(
        "error",
        "Pump Photo Required",
        "Capture a fuel pump photo before dispensing fuel.",
      );
      return;
    }

    // Safety check: ensure job hasn't already been completed
    const jobId = store.activeJob.jobId || store.activeJob.id;
    if (store.isJobCompleted(jobId)) {
      showToast(
        "error",
        "Already Fueled",
        `Job ${jobId} has already been fueled and is no longer available.`,
      );
      store.closeFlow();
      loadData();
      return;
    }

    store.setSubmitting(true);
    try {
      const fuelId = generateFuelRecordId(jobId);

      // Create the fuel record
      await createFuelRecord({
        fuelId,
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
        pumpPhotoURL,
      });

      // Mark job as fueled on the backend
      await markJobAsFueled(jobId, fuelId);

      // Mark job as completed locally (prevents re-appearance in list)
      store.markJobCompleted(jobId);

      const authCodeRef = store.authCode || "N/A";
      showToast(
        "success",
        "Fuel Dispensed",
        `${amount.toFixed(1)} litres recorded as ${fuelId}. Auth PIN: ${authCodeRef}. Job card removed from completed jobs.`,
      );

      setPumpPhotoUri(null);
      setPumpPhotoURL(null);
      setPumpPhotoUploading(false);

      // Close the flow and refresh data
      store.closeFlow();
      loadData();
    } catch (error: any) {
      const message =
        error?.message || "Failed to record fuel. Please try again.";
      showToast("error", "Dispense Failed", message);
    } finally {
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
                gap: Spacing.sm,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#F59E0B"
              />
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
              >
                {completedDeliveries.length} completed job
                {completedDeliveries.length !== 1 ? "s" : ""} available
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}
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
        style={[styles.fab, { backgroundColor: "#F59E0B" }]}
        onPress={openFlow}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Flow Modal */}
      <Modal
        visible={store.flowVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFlow}
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
                      : "Submit"}
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
            <View style={styles.stepRow}>
              {(["list", "authorization", "form"] as FlowStep[]).map(
                (s, idx) => {
                  const steps: FlowStep[] = ["list", "authorization", "form"];
                  const currentIdx = steps.indexOf(store.flowStep);
                  const stepIdx = steps.indexOf(s);
                  const completed = stepIdx < currentIdx;
                  const isCurrent = stepIdx === currentIdx;
                  let dotColor = colors.border;
                  if (completed) dotColor = "#10B981";
                  else if (isCurrent) dotColor = "#F59E0B";
                  let lineColor = colors.border;
                  if (stepIdx < 2 && stepIdx < currentIdx)
                    lineColor = "#10B981";
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

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
              keyboardShouldPersistTaps="handled"
            >
              {/* ============ STEP 1: Completed Jobs List ============ */}
              {store.flowStep === "list" && (
                <>
                  {completedDeliveries.length ? (
                    completedDeliveries.map((job) => {
                      const jobId = job.jobId || job.id;
                      const existingFuel = getJobFuelAmount(jobId);
                      const isCompleted = store.isJobCompleted(jobId);
                      return (
                        <TouchableOpacity
                          key={job.id}
                          style={[
                            styles.jobSelectCard,
                            {
                              borderColor: isCompleted
                                ? "#10B98130"
                                : colors.border,
                              opacity: isCompleted ? 0.5 : 1,
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
                                  ? "#10B98115"
                                  : "#F59E0B15",
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
                              color={isCompleted ? "#10B981" : "#F59E0B"}
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
                                      color: "#10B981",
                                      fontWeight: "600",
                                      marginTop: 1,
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
                                    backgroundColor: "#F59E0B10",
                                    borderColor: "#F59E0B30",
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="water"
                                  size={12}
                                  color="#F59E0B"
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: "#F59E0B",
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
                                    backgroundColor: "#10B98115",
                                    borderColor: "#10B98130",
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color="#10B981"
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: "#10B981",
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
                      gap: Spacing.sm,
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
                          backgroundColor: "#F59E0B15",
                          borderColor: "#F59E0B30",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#F59E0B",
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
                          gap: Spacing.sm,
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
                                backgroundColor: "#3B82F615",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons name="person" size={32} color="#3B82F6" />
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
                        gap: Spacing.lg,
                        paddingVertical: Spacing.xl,
                      }}
                    >
                      {store.authStatus === "pending" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: "#F59E0B15" },
                            ]}
                          >
                            <Ionicons
                              name="key-outline"
                              size={48}
                              color="#F59E0B"
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
                                { backgroundColor: "#F59E0B" },
                              ]}
                              onPress={() => store.setOtpModalVisible(true)}
                            >
                              <Ionicons
                                name="keypad-outline"
                                size={20}
                                color="#FFFFFF"
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
                              { backgroundColor: "#10B98115" },
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={48}
                              color="#10B981"
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: "#10B981",
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
                            The vendor has authorized fuel dispensing. Please
                            enter fuel amount below.
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.submitBtn,
                              { backgroundColor: "#10B981" },
                            ]}
                            onPress={() => store.setFlowStep("form")}
                          >
                            <Ionicons
                              name="water-outline"
                              size={20}
                              color="#FFFFFF"
                            />
                            <Text style={styles.submitBtnText}>
                              Enter Fuel Amount
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : store.authStatus === "denied" ? (
                        <>
                          <View
                            style={[
                              styles.authIconCircle,
                              { backgroundColor: "#EF444415" },
                            ]}
                          >
                            <Ionicons
                              name="close-circle"
                              size={48}
                              color="#EF4444"
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: "#EF4444",
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
                              { backgroundColor: "#3B82F6" },
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
                              color="#FFFFFF"
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
                              color="#94A3B8"
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: "#94A3B8",
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
                              { backgroundColor: "#3B82F6" },
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
                              color="#FFFFFF"
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
                            { backgroundColor: "#3B82F6" },
                          ]}
                          onPress={handleRequestAuthorization}
                          disabled={store.submitting}
                        >
                          {store.submitting ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Ionicons
                              name="key-outline"
                              size={20}
                              color="#FFFFFF"
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
                      gap: Spacing.sm,
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
                          backgroundColor: "#10B98115",
                          borderColor: "#10B98130",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#10B981",
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
                          gap: Spacing.sm,
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
                                backgroundColor: "#3B82F615",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons name="person" size={32} color="#3B82F6" />
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
                          { backgroundColor: "#F59E0B15" },
                        ]}
                      >
                        <Ionicons
                          name="water-outline"
                          size={22}
                          color="#F59E0B"
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
                          borderColor: "#F59E0B",
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <TextInput
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

                  {/* Fuel price info */}
                  {store.flowFuelAmount && fuelPrice > 0 ? (
                    <View
                      style={{
                        marginTop: Spacing.sm,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
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
                          color: "#10B981",
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
                          { backgroundColor: "#10B98115" },
                        ]}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={22}
                          color="#10B981"
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
                            <ActivityIndicator size="large" color="#FFFFFF" />
                            <Text style={styles.photoOverlayText}>Uploading...</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.photoPreviewWrap, styles.photoPlaceholder]}>
                        <Ionicons name="camera-outline" size={48} color="#94A3B8" />
                        <Text style={styles.photoPlaceholderText}>No photo captured</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.submitBtn,
                        {
                          backgroundColor: pumpPhotoURL ? "#10B981" : "#3B82F6",
                          opacity: pumpPhotoUploading ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleTakePumpPhoto}
                      disabled={pumpPhotoUploading}
                    >
                      {pumpPhotoUploading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Ionicons
                          name="camera-outline"
                          size={20}
                          color="#FFFFFF"
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
                              backgroundColor: "#F59E0B10",
                              borderColor: "#F59E0B30",
                            },
                          ]}
                        >
                          <Ionicons name="water" size={14} color="#F59E0B" />
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#F59E0B",
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
                        backgroundColor: "#F59E0B",
                        opacity: store.submitting ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleFlowSubmit}
                    disabled={store.submitting}
                  >
                    {store.submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                    <Text style={styles.submitBtnText}>
                      {store.submitting ? "Processing..." : "Confirm Fuel"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* OTP Modal */}
      <Modal
        visible={store.otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => store.setOtpModalVisible(false)}
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
                textAlign: "center",
                marginBottom: Spacing.lg,
              }}
            >
              Enter the Authorization PIN sent to the vendor's phone.
            </Text>

            <View
              style={[
                styles.otpInputWrap,
                {
                  borderColor: "#F59E0B",
                  backgroundColor: colors.inputBg,
                },
              ]}
            >
              <TextInput
                style={[styles.otpInput, { color: colors.text }]}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={store.otpInput}
                onChangeText={store.setOtpInput}
                maxLength={8}
                autoFocus
              />
            </View>

            <View style={styles.otpActions}>
              <TouchableOpacity
                style={[
                  styles.otpBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => store.setOtpModalVisible(false)}
              >
                <Text
                  style={[styles.otpBtnText, { color: colors.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.otpBtn, { backgroundColor: "#F59E0B" }]}
                onPress={handleVerifyOtp}
                disabled={store.authVerifying}
              >
                {store.authVerifying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.otpBtnText, { color: "#FFFFFF" }]}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const styles = StyleSheet.create({
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  // Flow sheet
  flowSheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  sheetSub: {
    fontSize: 13,
    marginTop: 2,
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
    justifyContent: "center",
    marginBottom: Spacing.lg,
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
  jobSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
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
    fontSize: 12,
    marginTop: 1,
  },

  fuelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: "flex-start",
  },

  // Back button
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    minWidth: 200,
  },

  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
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
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
    fontSize: 12,
    marginTop: 1,
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
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  photoPreviewWrap: {
    borderRadius: Radius.md,
    overflow: "hidden",
    marginBottom: Spacing.md,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  photoPreview: {
    width: "100%",
    height: 180,
  },

  photoPlaceholder: {
    backgroundColor: "#F8FAFC",
  },

  photoPlaceholderText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: Spacing.sm,
  },

  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },

  photoOverlayText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // OTP Modal
  otpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },

  otpTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  otpInputWrap: {
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
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
    gap: Spacing.sm,
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
