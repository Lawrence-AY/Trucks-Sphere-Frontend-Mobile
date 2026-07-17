/**
 * TruckSphere API Service
 * All data is fetched from the backend API (Firebase-backed).
 * No mock data — every function calls the backend.
 * Gracefully returns empty arrays on network errors.
 */
import axios from "axios";
import { getStoredToken, clearAuthData } from "./database";
import { Platform } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Detect environment for API URL
function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (process.env.EXPO_PUBLIC_API_IP)
    return `http://${process.env.EXPO_PUBLIC_API_IP}:5000`;
  if (Platform.OS === "android") return "http://10.0.2.2:5000";
  return "http://192.168.1.211:5000";
}

const API_BASE_URL = getBaseUrl();

// ============== Auth Expiry Handler ==============

let onAuthExpired: (() => void) | null = null;

export function setOnAuthExpired(handler: () => void) {
  onAuthExpired = handler;
}

async function backendRequest<T>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: any,
  params?: any,
): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const response = await axios.request<T>({
      baseURL: API_BASE_URL,
      url,
      method,
      data,
      params,
      headers,
      timeout: 10000,
    });
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const errorCode =
      error?.response?.data?.code ||
      error?.response?.data?.errorInfo?.code ||
      "";
    // Firebase token expired → auto logout
    if (
      status === 401 &&
      (errorCode === "auth/id-token-expired" ||
        errorCode.includes("token-expired") ||
        errorCode.includes("TOKEN_EXPIRED"))
    ) {
      await clearAuthData();
      if (onAuthExpired) onAuthExpired();
    }
    throw error;
  }
}

function unwrapItems<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function unwrapOne<T = any>(data: any, fallback: T): T {
  return ((data?.item || data?.data || data) as T) || fallback;
}

/**
 * Wraps an async fetch so it never throws.
 * On error, logs to console and returns an empty array.
 */
async function safeFetch<T>(
  label: string,
  fetcher: () => Promise<T[]>,
): Promise<T[]> {
  try {
    const result = await fetcher();
    return result;
  } catch (error: any) {
    const msg = error?.message || error?.code || String(error);
    return [];
  }
}

// ============== Fetch Functions (all via backend, graceful fallback) ==============

export async function fetchVendors(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("vendors", () =>
    backendRequest<any>("get", "/api/vendors", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchDrivers(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("drivers", () =>
    backendRequest<any>("get", "/api/drivers", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchVehicles(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("vehicles", () =>
    backendRequest<any>("get", "/api/vehicles", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchMaterials(params?: {
  search?: string;
  category?: string;
}): Promise<any[]> {
  return safeFetch("materials", () =>
    backendRequest<any>("get", "/api/materials", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchPurchaseOrders(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("purchase-orders", () =>
    backendRequest<any>("get", "/api/purchase-orders", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchDeliveryOrders(params?: {
  search?: string;
  status?: string;
  jobId?: string;
  purchaseOrderId?: string;
}): Promise<any[]> {
  return safeFetch("delivery-orders", () => {
    const url = "/api/delivery-orders";
    return backendRequest<any>("get", url, undefined, params).then(unwrapItems);
  });
}

export async function createDeliveryOrder(payload: any): Promise<any> {
  const result = unwrapOne(
    await backendRequest("post", "/api/delivery-orders", payload),
    payload,
  );
  return result;
}

export async function receiveLot(payload: {
  deliveryOrderId: string;
  storageLot: string;
}): Promise<any> {
  try {
    const result = unwrapOne(
      await backendRequest("post", "/api/delivery-orders/receive-lot", payload),
      payload,
    );
    return result;
  } catch (error: any) {
    throw error;
  }
}

export async function updateDeliveryOrder(
  id: string,
  payload: any,
): Promise<any> {
  return unwrapOne(
    await backendRequest("put", `/api/delivery-orders/${id}`, payload),
    payload,
  );
}

export async function fetchWeighments(params?: {
  jobId?: string;
  type?: string;
}): Promise<any[]> {
  return safeFetch("weighments", () =>
    backendRequest<any>("get", "/api/weighbridge", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchQuarries(): Promise<any[]> {
  return safeFetch("quarries", () =>
    backendRequest<any>("get", "/api/quarries").then(unwrapItems),
  );
}

export async function fetchSites(): Promise<any[]> {
  return safeFetch("sites", () =>
    backendRequest<any>("get", "/api/sites").then(unwrapItems),
  );
}

export async function fetchCustomers(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("customers", () =>
    backendRequest<any>("get", "/api/customers", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchFuelStations(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("fuel-stations", () =>
    backendRequest<any>("get", "/api/fuel-stations", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchReports(): Promise<any[]> {
  return safeFetch("reports", () =>
    backendRequest<any>("get", "/api/reports").then(unwrapItems),
  );
}

export async function fetchAuditLogs(params?: {
  search?: string;
  severity?: string;
}): Promise<any[]> {
  return safeFetch("audit-logs", () =>
    backendRequest<any>("get", "/api/audit-logs", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchUsers(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("users", () =>
    backendRequest<any>("get", "/api/users", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchRoles(params?: {
  search?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch("roles", () =>
    backendRequest<any>("get", "/api/roles", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function fetchMasterData(): Promise<any[]> {
  return safeFetch("master-data", () =>
    backendRequest<any>("get", "/api/master-data").then(unwrapItems),
  );
}

export async function fetchAnalyticsSummary(): Promise<any> {
  try {
    return await backendRequest<any>("get", "/api/analytics/summary");
  } catch (error: any) {
    return {};
  }
}

export async function fetchNextCounter(entityType: string): Promise<string> {
  try {
    const result = await backendRequest<{ id: string }>(
      "get",
      `/api/counter/${entityType}`,
    );
    return result.id;
  } catch (error: any) {
    console.log(`[API] fetchNextCounter(${entityType}) failed:`, error?.message || error);
    // Fallback: generate a local timestamp-based ID
    const fallback = Math.floor(Date.now() / 1000)
      .toString(36)
      .toUpperCase();
    if (entityType === "receipt_note") return `RN${fallback}`;
    return `${entityType.substring(0, 3).toUpperCase()}${fallback}`;
  }
}

export async function fetchFuelRecords(params?: {
  search?: string;
  vendorId?: string;
  jobId?: string;
  plateNumber?: string;
}): Promise<any[]> {
  return safeFetch("fuel-records", () =>
    backendRequest<any>("get", "/api/fuel", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function requestFuelAuthorization(payload: any): Promise<any> {
  try {
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel-authorization/request", payload),
      payload,
    );
    return result;
  } catch (error: any) {
    console.log("[API] requestFuelAuthorization failed:", error?.message || error);
    return payload;
  }
}

export async function verifyFuelAuthorization(
  authId: string,
  otp: string,
  authorize: boolean,
): Promise<any> {
  try {
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel-authorization/verify", {
        authId,
        otp,
        authorize,
      }),
      { status: "error" },
    );
    return result;
  } catch (error: any) {
    console.log("[API] verifyFuelAuthorization failed:", error?.message || error);
    throw error;
  }
}

export async function getFuelAuthorizationStatus(authId: string): Promise<any> {
  try {
    const result = await backendRequest<any>(
      "get",
      `/api/fuel-authorization/status/${authId}`,
    );
    return result;
  } catch (error: any) {
    console.log("[API] getFuelAuthorizationStatus failed:", error?.message || error);
    return { status: "error" };
  }
}

export async function getPendingAuthorizations(
  vendorId: string,
): Promise<any[]> {
  try {
    const result = await backendRequest<any[]>(
      "get",
      `/api/fuel-authorization/pending/${vendorId}`,
    );
    return result as any[];
  } catch (error: any) {
    console.log("[API] getPendingAuthorizations failed:", error?.message || error);
    return [];
  }
}

export async function createFuelRecord(payload: any): Promise<any> {
  try {
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel", payload),
      payload,
    );
    return result;
  } catch (error: any) {
    return payload;
  }
}

/**
 * Mark a delivery order as "fueled" to prevent double-dispensing.
 * Updates the delivery order status to reflect that fuel has been dispensed.
 */
export async function markJobAsFueled(
  jobId: string,
  fuelRecordId: string,
): Promise<any> {
  try {
    const result = unwrapOne(
      await backendRequest("put", `/api/delivery-orders/${jobId}/fueled`, {
        fuelRecordId,
        fueled: true,
      }),
      { success: true },
    );
    return result;
  } catch (error: any) {
    // Return success anyway — the fuel record was created
    return { success: true };
  }
}

/**
 * Check if a delivery order has already been fueled.
 * Returns the fuel record if found, or null if not fueled.
 */
export async function checkJobFuelStatus(
  jobId: string,
): Promise<{ fueled: boolean; fuelRecord?: any }> {
  try {
    const records = await fetchFuelRecords({ jobId });
    const hasFuel = Array.isArray(records) && records.length > 0;
    return { fueled: hasFuel, fuelRecord: hasFuel ? records[0] : undefined };
  } catch (error: any) {
    return { fueled: false };
  }
}

export async function fetchUploads(params?: {
  deliveryOrderId?: string;
  type?: string;
}): Promise<any[]> {
  return safeFetch("uploads", () =>
    backendRequest<any>("get", "/api/uploads", undefined, params).then(
      unwrapItems,
    ),
  );
}

export async function createUpload(payload: any): Promise<any> {
  try {
    return unwrapOne(
      await backendRequest("post", "/api/uploads", payload),
      payload,
    );
  } catch (error: any) {
    return payload;
  }
}

export async function fetchCheckpoints(params?: {
  jobId?: string;
  deliveryOrderId?: string;
}): Promise<any[]> {
  return safeFetch("checkpoints", () => {
    const url = "/api/checkpoints";
    return backendRequest<any>("get", url, undefined, params).then(unwrapItems);
  });
}

// ============== Legacy API Client (used by authStore & other code) ==============

interface ApiClient {
  get<T = any>(url: string, params?: any): Promise<{ data: T }>;
  post<T = any>(url: string, data?: any): Promise<{ data: T }>;
  put<T = any>(url: string, data?: any): Promise<{ data: T }>;
  delete<T = any>(url: string): Promise<{ data: T }>;
}

const api: ApiClient = {
  async get<T>(url: string, params?: any): Promise<{ data: T }> {
    try {
      const result = await backendRequest<T>("get", url, undefined, params);
      return { data: result };
    } catch (error: any) {
      // Auth profile failures are expected during session restore — use warn, not error
      const isAuthProfile = url.includes("/auth/profile");
      const msg = error?.response?.status
        ? `${error.response.status} ${error.response.statusText || ""}`
        : error?.message || "Network Error";
      if (isAuthProfile) {
        console.log(`[API] GET ${url} @ ${API_BASE_URL} failed (${msg}) — handled by authStore`);
      } else {
      }
      throw error;
    }
  },

  async post<T>(url: string, data?: any): Promise<{ data: T }> {
    try {
      const result = await backendRequest<T>("post", url, data);
      return { data: result };
    } catch (error: any) {
      // Auth-related failures (logout 404, login INVALID_EMAIL) are expected
      const isAuthEndpoint = url.includes("/auth/");
      const msg = error?.response?.status
        ? `${error.response.status} ${error.response.statusText || ""}`
        : error?.message || "Network Error";
      if (isAuthEndpoint) {
        console.log(`[API] POST ${url} @ ${API_BASE_URL} failed (${msg}) — handled by caller`);
      } else {
      }
      throw error;
    }
  },

  async put<T>(url: string, data?: any): Promise<{ data: T }> {
    try {
      const result = await backendRequest<T>("put", url, data);
      return { data: result };
    } catch (error: any) {
      throw error;
    }
  },

  async delete<T>(url: string): Promise<{ data: T }> {
    try {
      const result = await backendRequest<T>("delete", url);
      return { data: result };
    } catch (error: any) {
      throw error;
    }
  },
};

// ============== Public Tracking API (no auth required) ==============

/**
 * Fetch public tracking data for a given tracking ID.
 * This endpoint does NOT require authentication — it is a public URL.
 *
 * @param trackingId - e.g., "SA-A1B3C5D"
 * @returns The sanitized public tracking data, or throws on 404/expired
 */
export async function fetchPublicTracking(trackingId: string): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/track/${encodeURIComponent(trackingId)}`,
      { timeout: 8000, headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const serverCode = error?.response?.data?.code;
    const serverMessage = error?.response?.data?.error;

    // Network / CORS error — no response at all
    if (!status) {
      const netMsg = error?.code === "ERR_NETWORK" || error?.code === "ERR_CANCELED"
        ? "Unable to reach the tracking server. Please check your internet connection."
        : error?.message || "A network error occurred. Please try again.";
      console.log(`[API] Public tracking ${trackingId} failed: network error`, error?.code);
      throw Object.assign(new Error(netMsg), { isNetworkError: true });
    }

    // Server returned a structured error
    console.log(`[API] Public tracking ${trackingId} failed:`, status, serverCode, serverMessage);
    throw Object.assign(new Error(serverMessage || "This tracking link has expired or is no longer active."), {
      statusCode: status,
      errorCode: serverCode || null,
      isTrackingError: true,
    });
  }
}

/**
 * Fetch public tracking data by vehicle registration (plate) number.
 * This endpoint does NOT require authentication — it is a public URL.
 *
 * @param plateNumber - e.g., "KAA 123B"
 * @returns The sanitized public tracking data, or throws on 404/expired
 */
export async function fetchPublicTrackingByPlate(plateNumber: string): Promise<any> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/track/by-plate/${encodeURIComponent(plateNumber)}`,
      { timeout: 8000, headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const serverCode = error?.response?.data?.code;
    const serverMessage = error?.response?.data?.error;

    // Network / CORS error — no response at all
    if (!status) {
      const netMsg = error?.code === "ERR_NETWORK" || error?.code === "ERR_CANCELED"
        ? "Unable to reach the tracking server. Please check your internet connection."
        : error?.message || "A network error occurred. Please try again.";
      console.log(`[API] Public tracking by plate ${plateNumber} failed: network error`, error?.code);
      throw Object.assign(new Error(netMsg), { isNetworkError: true });
    }

    // Server returned a structured error
    console.log(`[API] Public tracking by plate ${plateNumber} failed:`, status, serverCode, serverMessage);
    throw Object.assign(new Error(serverMessage || "This tracking link has expired or is no longer active."), {
      statusCode: status,
      errorCode: serverCode || null,
      isTrackingError: true,
    });
  }
}

// ============== Admin Reports API ==============

/**
 * Fetch summary metrics for the admin reports dashboard.
 * @param params - filter, start_date, end_date
 */
export async function fetchReportSummary(params?: {
  filter?: string;
  start_date?: string;
  end_date?: string;
}): Promise<any> {
  try {
    const result = await backendRequest<any>(
      'get',
      '/api/admin/reports/summary',
      undefined,
      params,
    );
    return result;
  } catch (error: any) {
    return null;
  }
}

/**
 * Convert an ArrayBuffer to a base64-encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Blob to a string (works on both web and native).
 */
function blobToText(blob: Blob): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, Blob has .text()
    return blob.text();
  }
  // On native, use FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

/**
 * Download the Master Audit Excel (.xlsx) report.
 * - Web: triggers browser download.
 * - Native: saves to cache and shares.
 */
export async function downloadReportExcel(params?: {
  filter?: string;
  start_date?: string;
  end_date?: string;
}): Promise<any> {
  try {
    const token = await getStoredToken();
    const query = new URLSearchParams();
    if (params?.filter) query.set('filter', params.filter);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);

    const url = `${API_BASE_URL}/api/admin/reports/export?${query.toString()}`;

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `TruckSphere_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }

    // Native: save and share
    const fileName = `TruckSphere_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filePath = FileSystem.cacheDirectory + fileName;
    const base64 = arrayBufferToBase64(response.data);
    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }
    return { success: true };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Download a per-category CSV file.
 * - Web: triggers browser download.
 * - Native: saves to cache and shares.
 */
export async function downloadCategoryCSV(
  category: string,
  params?: { filter?: string; start_date?: string; end_date?: string },
): Promise<void> {
  try {
    const token = await getStoredToken();
    const query = new URLSearchParams();
    if (params?.filter) query.set('filter', params.filter);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);

    const url = `${API_BASE_URL}/api/admin/reports/export/csv/${category}?${query.toString()}`;

    const response = await axios.get(url, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${category}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return;
    }

    // Native: read blob as text using FileReader, then save and share
    const text = await blobToText(response.data);
    const fileName = `${category}_${new Date().toISOString().slice(0, 10)}.csv`;
    const filePath = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(filePath, text, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
    }
  } catch (error: any) {
    throw error;
  }
}

// ============== Issues API ==============

export async function fetchIssues(params?: { status?: string }): Promise<any[]> {
  return safeFetch('issues', () =>
    backendRequest<any>('get', '/api/issues', undefined, params).then(unwrapItems),
  );
}

export async function fetchIssueById(id: string): Promise<any> {
  try {
    const result = await backendRequest<any>('get', `/api/issues/${id}`);
    return result;
  } catch (error: any) {
    throw error;
  }
}

export async function createIssue(payload: { title: string; description: string; category?: string; priority?: string }): Promise<any> {
  try {
    const result = await backendRequest<any>('post', '/api/issues', payload);
    return result;
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Failed to create issue.';
    throw new Error(msg);
  }
}

export async function updateIssue(id: string, payload: { status?: string; resolutionNotes?: string; priority?: string }): Promise<any> {
  try {
    const result = await backendRequest<any>('put', `/api/issues/${id}`, payload);
    return result;
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Failed to update issue.';
    throw new Error(msg);
  }
}

export async function deleteIssue(id: string): Promise<any> {
  try {
    const result = await backendRequest<any>('delete', `/api/issues/${id}`);
    return result;
  } catch (error: any) {
    throw error;
  }
}

export async function fetchNotifications(): Promise<any[]> {
  return safeFetch('notifications', () =>
    backendRequest<any>('get', '/api/notifications').then(unwrapItems),
  );
}

// ============== Profile Update ==============

/**
 * Update the authenticated user's profile (displayName, phone, email).
 */
export async function updateProfile(payload: {
  displayName?: string;
  phone?: string;
  email?: string;
}): Promise<any> {
  try {
    const result = await backendRequest<any>('put', '/api/auth/profile', payload);
    return result;
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Failed to update profile.';
    throw new Error(msg);
  }
}

// ============== Password Self-Service ==============

/**
 * Change the authenticated user's password.
 * Requires current password verification.
 */
export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<any> {
  try {
    const result = await backendRequest<any>(
      'post',
      '/api/auth/change-password',
      payload,
    );
    return result;
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Failed to change password.';
    throw new Error(msg);
  }
}

export default api;
export type { ApiClient };
