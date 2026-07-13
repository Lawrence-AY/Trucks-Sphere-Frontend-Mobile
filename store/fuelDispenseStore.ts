/**
 * Fuel Dispense Store
 *
 * Manages the fuel dispensing flow state with:
 * - Persistence via SecureStore for crash/network recovery
 * - Job card status tracking (prevents double-dispensing)
 * - Step-by-step flow state (list → authorization → form)
 * - Offline resilience
 */
import { create } from "zustand";
import { setItem, getItem, removeItem } from "../services/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = "fuel_dispense_state";
const COMPLETED_JOBS_KEY = "fuel_completed_jobs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FlowStep = "list" | "authorization" | "form";
export type AuthStatus =
  | "pending"
  | "authorized"
  | "denied"
  | "expired"
  | "error";

export interface FuelDispenseState {
  // Flow state
  flowVisible: boolean;
  flowStep: FlowStep;
  flowFuelAmount: string;

  // Active job
  activeJob: any | null;

  // Authorization state
  authId: string | null;
  authStatus: AuthStatus;
  authCode: string | null;
  otpInput: string;
  otpModalVisible: boolean;
  authVerifying: boolean;

  // Submission
  submitting: boolean;

  // Completed jobs (set of job IDs that have been fueled)
  completedJobIds: string[];

  // Actions
  openFlow: () => void;
  closeFlow: () => void;
  setFlowStep: (step: FlowStep) => void;
  setFlowFuelAmount: (amount: string) => void;
  setActiveJob: (job: any) => void;
  setAuthId: (id: string | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setAuthCode: (code: string | null) => void;
  setOtpInput: (input: string) => void;
  setOtpModalVisible: (visible: boolean) => void;
  setAuthVerifying: (verifying: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  markJobCompleted: (jobId: string) => void;
  isJobCompleted: (jobId: string) => boolean;
  resetFlow: () => void;
  persistState: () => Promise<void>;
  restoreState: () => Promise<boolean>;
  clearPersistedState: () => Promise<void>;
  loadCompletedJobs: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useFuelDispenseStore = create<FuelDispenseState>((set, get) => ({
  // Initial state
  flowVisible: false,
  flowStep: "list",
  flowFuelAmount: "",
  activeJob: null,
  authId: null,
  authStatus: "pending",
  authCode: null,
  otpInput: "",
  otpModalVisible: false,
  authVerifying: false,
  submitting: false,
  completedJobIds: [],

  // ---- Actions ----

  openFlow: () => {
    set({
      flowVisible: true,
      flowStep: "list",
      flowFuelAmount: "",
      activeJob: null,
      authId: null,
      authStatus: "pending",
      authCode: null,
      otpInput: "",
      otpModalVisible: false,
      authVerifying: false,
      submitting: false,
    });
  },

  closeFlow: () => {
    set({
      flowVisible: false,
      flowStep: "list",
      flowFuelAmount: "",
      activeJob: null,
      authId: null,
      authStatus: "pending",
      authCode: null,
      otpInput: "",
      otpModalVisible: false,
      authVerifying: false,
      submitting: false,
    });
    // Clear persisted state on successful close
    get().clearPersistedState();
  },

  setFlowStep: (step) => set({ flowStep: step }),
  setFlowFuelAmount: (amount) => set({ flowFuelAmount: amount }),
  setActiveJob: (job) => set({ activeJob: job }),
  setAuthId: (id) => set({ authId: id }),
  setAuthStatus: (status) => set({ authStatus: status }),
  setAuthCode: (code) => set({ authCode: code }),
  setOtpInput: (input) => set({ otpInput: input }),
  setOtpModalVisible: (visible) => set({ otpModalVisible: visible }),
  setAuthVerifying: (verifying) => set({ authVerifying: verifying }),
  setSubmitting: (submitting) => set({ submitting }),

  markJobCompleted: (jobId) => {
    const { completedJobIds } = get();
    if (!completedJobIds.includes(jobId)) {
      const updated = [...completedJobIds, jobId];
      set({ completedJobIds: updated });
      // Persist completed jobs list
      setItem(COMPLETED_JOBS_KEY, JSON.stringify(updated)).catch(() => {});
    }
  },

  isJobCompleted: (jobId) => {
    return get().completedJobIds.includes(jobId);
  },

  resetFlow: () => {
    set({
      flowStep: "list",
      flowFuelAmount: "",
      activeJob: null,
      authId: null,
      authStatus: "pending",
      authCode: null,
      otpInput: "",
      otpModalVisible: false,
      authVerifying: false,
      submitting: false,
    });
  },

  persistState: async () => {
    const state = get();
    // Only persist if we're in the middle of a flow
    if (!state.flowVisible) return;

    const payload = JSON.stringify({
      flowStep: state.flowStep,
      flowFuelAmount: state.flowFuelAmount,
      activeJob: state.activeJob,
      authId: state.authId,
      authStatus: state.authStatus,
      authCode: state.authCode,
      otpInput: state.otpInput,
      otpModalVisible: state.otpModalVisible,
      authVerifying: state.authVerifying,
      submitting: state.submitting,
      persistedAt: new Date().toISOString(),
    });

    await setItem(STORAGE_KEY, payload);
  },

  restoreState: async () => {
    try {
      const stored = await getItem(STORAGE_KEY);
      if (!stored) return false;

      const parsed = JSON.parse(stored);
      const persistedAt = parsed.persistedAt
        ? new Date(parsed.persistedAt)
        : null;

      // Only restore if persisted within the last 30 minutes
      if (persistedAt && Date.now() - persistedAt.getTime() > 30 * 60 * 1000) {
        // Expired — clear it
        await removeItem(STORAGE_KEY);
        return false;
      }

      set({
        flowVisible: true,
        flowStep: parsed.flowStep || "list",
        flowFuelAmount: parsed.flowFuelAmount || "",
        activeJob: parsed.activeJob || null,
        authId: parsed.authId || null,
        authStatus: parsed.authStatus || "pending",
        authCode: parsed.authCode || null,
        otpInput: parsed.otpInput || "",
        otpModalVisible: parsed.otpModalVisible || false,
        authVerifying: parsed.authVerifying || false,
        submitting: parsed.submitting || false,
      });

      return true;
    } catch {
      return false;
    }
  },

  clearPersistedState: async () => {
    try {
      await removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  },

  loadCompletedJobs: async () => {
    try {
      const stored = await getItem(COMPLETED_JOBS_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          set({ completedJobIds: ids });
        }
      }
    } catch {
      // Ignore
    }
  },
}));
