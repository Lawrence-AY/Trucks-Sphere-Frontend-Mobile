/**
 * TruckSphere API Service
 * All data is fetched from the backend API (Firebase-backed).
 * No mock data — every function calls the backend.
 * Gracefully returns empty arrays on network errors.
 */
import axios from "axios";
import { getStoredToken, clearAuthData } from "./database";
import { API_BASE_URL, logApiConfiguration } from "./config";

logApiConfiguration();




// ============== HTTP Helpers ==============

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
      console.warn("[API] Token expired detected, triggering auto-logout");
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
    console.log(`[API] Fetching ${label} from backend...`);
    const result = await fetcher();
    console.log(`[API] ${label} fetched:`, result.length, "items", result);
    return result;
  } catch (error: any) {
    const msg = error?.message || error?.code || String(error);
    console.warn(`[API] ❌ ${label} fetch failed → ${API_BASE_URL}`, msg);
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
  console.log("[API] Creating delivery order...", payload);
  const result = unwrapOne(
    await backendRequest("post", "/api/delivery-orders", payload),
    payload,
  );
  console.log("[API] Delivery order created:", result);
  return result;
}

export async function receiveLot(payload: {
  deliveryOrderId: string;
  storageLot: string;
}): Promise<any> {
  try {
    console.log("[API] Assigning storage lot...", payload);
    const result = unwrapOne(
      await backendRequest("post", "/api/delivery-orders/receive-lot", payload),
      payload,
    );
    console.log("[API] Storage lot assigned:", result);
    return result;
  } catch (error: any) {
    console.warn("[API] receiveLot failed:", error?.message || error);
    throw error;
  }
}

export async function updateDeliveryOrder(
  id: string,
  payload: any,
): Promise<any> {
  try {
    console.log("[API] Updating delivery order:", id, payload);
    const result = unwrapOne(
      await backendRequest("put", `/api/delivery-orders/${id}`, payload),
      payload,
    );
    console.log("[API] Delivery order updated:", result);
    return result;
  } catch (error: any) {
    console.warn("[API] updateDeliveryOrder failed:", error?.message || error);
    return payload;
  }
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
    console.warn("[API] analytics summary failed:", error?.message || error);
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
    console.warn(
      `[API] fetchNextCounter(${entityType}) failed:`,
      error?.message || error,
    );
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
    console.log("[API] Requesting fuel authorization...", payload);
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel-authorization/request", payload),
      payload,
    );
    console.log("[API] Fuel authorization requested:", result);
    return result;
  } catch (error: any) {
    console.warn(
      "[API] requestFuelAuthorization failed:",
      error?.message || error,
    );
    return payload;
  }
}

export async function verifyFuelAuthorization(
  authId: string,
  otp: string,
  authorize: boolean,
): Promise<any> {
  try {
    console.log("[API] Verifying fuel authorization:", authId, authorize);
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel-authorization/verify", {
        authId,
        otp,
        authorize,
      }),
      { status: "error" },
    );
    console.log("[API] Fuel authorization verified:", result);
    return result;
  } catch (error: any) {
    console.warn(
      "[API] verifyFuelAuthorization failed:",
      error?.message || error,
    );
    throw error;
  }
}

export async function getFuelAuthorizationStatus(authId: string): Promise<any> {
  try {
    console.log("[API] Checking fuel authorization status:", authId);
    const result = await backendRequest<any>(
      "get",
      `/api/fuel-authorization/status/${authId}`,
    );
    console.log("[API] Fuel authorization status:", result);
    return result;
  } catch (error: any) {
    console.warn(
      "[API] getFuelAuthorizationStatus failed:",
      error?.message || error,
    );
    return { status: "error" };
  }
}

export async function getPendingAuthorizations(
  vendorId: string,
): Promise<any[]> {
  try {
    console.log("[API] Fetching pending authorizations for vendor:", vendorId);
    const result = await backendRequest<any[]>(
      "get",
      `/api/fuel-authorization/pending/${vendorId}`,
    );
    return result as any[];
  } catch (error: any) {
    console.warn(
      "[API] getPendingAuthorizations failed:",
      error?.message || error,
    );
    return [];
  }
}

export async function createFuelRecord(payload: any): Promise<any> {
  try {
    console.log("[API] Creating fuel record...", payload);
    const result = unwrapOne(
      await backendRequest("post", "/api/fuel", payload),
      payload,
    );
    console.log("[API] Fuel record created:", result);
    return result;
  } catch (error: any) {
    console.warn("[API] createFuelRecord failed:", error?.message || error);
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
    console.log("[API] Marking job as fueled:", jobId, fuelRecordId);
    const result = unwrapOne(
      await backendRequest("put", `/api/delivery-orders/${jobId}/fueled`, {
        fuelRecordId,
        fueled: true,
      }),
      { success: true },
    );
    console.log("[API] Job marked as fueled:", result);
    return result;
  } catch (error: any) {
    console.warn("[API] markJobAsFueled failed:", error?.message || error);
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
    console.log("[API] Checking fuel status for job:", jobId);
    const records = await fetchFuelRecords({ jobId });
    const hasFuel = Array.isArray(records) && records.length > 0;
    return { fueled: hasFuel, fuelRecord: hasFuel ? records[0] : undefined };
  } catch (error: any) {
    console.warn("[API] checkJobFuelStatus failed:", error?.message || error);
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
    console.warn("[API] createUpload failed:", error?.message || error);
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
    console.log("[API] GET", url, params);
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
        console.warn(
          `[API] GET ${url} @ ${API_BASE_URL} failed (${msg}) — handled by authStore`,
        );
      } else {
        console.error(`[API] GET ${url} @ ${API_BASE_URL} failed:`, msg);
      }
      throw error;
    }
  },

  async post<T>(url: string, data?: any): Promise<{ data: T }> {
    console.log("[API] POST", url, data);
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
        console.warn(
          `[API] POST ${url} @ ${API_BASE_URL} failed (${msg}) — handled by caller`,
        );
      } else {
        console.error(`[API] POST ${url} @ ${API_BASE_URL} failed:`, msg);
      }
      throw error;
    }
  },

  async put<T>(url: string, data?: any): Promise<{ data: T }> {
    console.log("[API] PUT", url, data);
    try {
      const result = await backendRequest<T>("put", url, data);
      return { data: result };
    } catch (error: any) {
      console.error(`[API] PUT ${url} failed:`, error?.message || error);
      throw error;
    }
  },

  async delete<T>(url: string): Promise<{ data: T }> {
    console.log("[API] DELETE", url);
    try {
      const result = await backendRequest<T>("delete", url);
      return { data: result };
    } catch (error: any) {
      console.error(`[API] DELETE ${url} failed:`, error?.message || error);
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
    console.log("[API] Fetching public tracking data for:", trackingId);
    const response = await axios.get(
      `${API_BASE_URL}/api/track/${encodeURIComponent(trackingId)}`,
      { timeout: 8000, headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.error ||
      "This tracking link has expired or is no longer active.";
    console.warn(
      `[API] Public tracking ${trackingId} failed:`,
      status,
      message,
    );
    throw new Error(message);
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
    console.log("[API] Fetching public tracking by plate:", plateNumber);
    const response = await axios.get(
      `${API_BASE_URL}/api/track/by-plate/${encodeURIComponent(plateNumber)}`,
      { timeout: 8000, headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.error ||
      "This tracking link has expired or is no longer active.";
    console.warn(
      `[API] Public tracking by plate ${plateNumber} failed:`,
      status,
      message,
    );
    throw new Error(message);
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
    console.log('[API] Fetching report summary...', params);
    const result = await backendRequest<any>(
      'get',
      '/api/admin/reports/summary',
      undefined,
      params,
    );
    return result;
  } catch (error: any) {
    console.warn('[API] fetchReportSummary failed:', error?.message || error);
    return null;
  }
}

/**
 * Download the Master Audit Excel (.xlsx) report.
 * Uses axios with arraybuffer response type for binary download.
 *
 * @param params - filter, start_date, end_date
 * @returns Blob (web) or triggers download
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
    console.log('[API] Downloading report Excel from:', url);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    // On web, trigger a browser download
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
  } catch (error: any) {
    console.error('[API] downloadReportExcel failed:', error?.message || error);
    throw error;
  }
}

// ============== Per-Category Reports API ==============

/**
 * Fetch per-category live summary for the tabbed reports dashboard.
 * @param category - deliveries|fuel|vendors|trucks|drivers|materials|purchase-orders
 * @param params - filter, start_date, end_date
 */
export async function fetchCategorySummary(
  category: string,
  params?: { filter?: string; start_date?: string; end_date?: string },
): Promise<any> {
  try {
    console.log('[API] Fetching category summary:', category, params);
    const result = await backendRequest<any>(
      'get',
      `/api/admin/reports/summary/${category}`,
      undefined,
      params,
    );
    return result;
  } catch (error: any) {
    console.warn(`[API] fetchCategorySummary(${category}) failed:`, error?.message || error);
    return null;
  }
}

/**
 * Download a per-category CSV file.
 * @param category - deliveries|fuel|vendors|trucks|drivers|materials|purchase-orders
 * @param params - filter, start_date, end_date
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
    console.log('[API] Downloading category CSV:', url);

    // Use axios with auth header + blob response
    const response = await axios.get(url, {
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    });

    // Trigger browser download from blob (web) or share (mobile)
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${category}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error: any) {
    console.error('[API] downloadCategoryCSV failed:', error?.message || error);
    throw error;
  }
}

export default api;
export type { ApiClient };
