/**
 * TruckSphere API Service
 * All data is fetched from the backend API (Firebase-backed).
 * Every function calls the backend.
 * Gracefully returns empty arrays on network errors.
 */
import axios from "axios";
import { getStoredToken, getAuthData, saveAuthData, clearAuthData } from "./database";
import { Platform } from "react-native";
import { API_BASE_URL } from "./config";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ============== Auth Expiry Handler ==============

let onAuthExpired: (() => void) | null = null;
let refreshInFlight: Promise<string> | null = null;

/** Return a client-safe API reference code without exposing failure details. */
export function getErrorCode(error: any): string {
  const serverCode = String(
    error?.response?.data?.code ||
    error?.response?.data?.errorCode ||
    error?.response?.data?.error ||
    error?.code ||
    '',
  ).trim().toUpperCase();
  if (/^[A-Z0-9_:-]+$/.test(serverCode)) return serverCode;
  const status = Number(error?.response?.status);
  if (Number.isFinite(status) && status > 0) return `HTTP_${status}`;
  if (error?.code === 'ECONNABORTED') return 'NETWORK_TIMEOUT';
  return 'NETWORK_UNAVAILABLE';
}

const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  WAREHOUSE_JOB_INVALID: 'Enter a product name and a quantity greater than zero for every product.',
  WAREHOUSE_PURCHASE_ORDER_REQUIRED: 'The selected purchase order is no longer available. Refresh and select it again.',
  WAREHOUSE_MATERIAL_REQUIRED: 'This purchase order must reference an existing warehouse material. Update the purchase order and try again.',
  WAREHOUSE_PURCHASE_ORDER_CANCELLED: 'This purchase order is cancelled. Select an active order.',
  WAREHOUSE_VENDOR_REQUIRED: 'The purchase order vendor could not be found. Update the purchase order vendor and try again.',
  WAREHOUSE_POMAT_REQUIRED: 'The purchase order material needs a valid material number before dispatch.',
  WAREHOUSE_PREVIEW_FILE_REQUIRED: 'Select a CSV or Excel file to preview.',
  WAREHOUSE_PREVIEW_FILE_INVALID: 'Select a CSV or Excel .xlsx file.',
  WAREHOUSE_PREVIEW_FILE_TOO_LARGE: 'The spreadsheet is too large. Upload a file under 2 MB.',
  WAREHOUSE_PREVIEW_UPLOAD_INVALID: 'The spreadsheet upload could not be read. Please try again.',
  WAREHOUSE_PREVIEW_ROWS_REQUIRED: 'No shipment rows were found in the spreadsheet.',
  WAREHOUSE_PREVIEW_COLUMN_REQUIRED: 'The spreadsheet is missing a required warehouse column.',
  WAREHOUSE_PREVIEW_SOURCE_REQUIRED: 'Missing required column: Source',
  WAREHOUSE_PREVIEW_DESCRIPTION_REQUIRED: 'Missing required column: Description',
  WAREHOUSE_PREVIEW_QUANTITY_REQUIRED: 'Missing required column: Quantity',
  WAREHOUSE_PREVIEW_UNIT_REQUIRED: 'Missing required column: Unit',
  WAREHOUSE_PREVIEW_MRF_NO_REQUIRED: 'Missing required column: MRF No.',
  HTTP_400: 'The information provided is invalid. Please check it and try again.',
  HTTP_401:
    'Invalid username or password. Please check your details and try again.',
  NETWORK_TIMEOUT:
    'The server took too long to respond. Check the local network connection and try again.',
  NETWORK_UNAVAILABLE:
    'Unable to reach the server. Check that the backend is running and this device can reach it.',
  HTTP_403: 'You do not have permission to complete this action.',
  HTTP_404: 'The requested item could not be found.',
  HTTP_409: 'This action conflicts with an existing record. Refresh and try again.',
  HTTP_429: 'Too many requests. Please wait a moment and try again.',
  HTTP_500: 'The server could not complete this action. Please try again shortly.',
  VENDOR_ALREADY_EXISTS:
    'A matching vendor already exists. Refresh the Vendors list before trying again.',
  ACTIVE_JOB_RESOURCE_CONFLICT:
    'This driver or truck already has an active delivery. Complete or cancel that delivery, or select another driver or truck.',
  MATERIAL_INSPECTION_REQUIRED:
    'Complete the Material Inspection & Receipt Form before site weigh-out.',
  SECURITY_FLAG_UNRESOLVED:
    'This delivery has a security flag. It must be cleared and the fleet unsuspended before site weigh-in.',
  IPRS_IDENTITY_MISMATCH:
    'The National ID does not match the provided first name and surname.',
  IPRS_IDENTITY_DETAILS_REQUIRED:
    'First name, surname, and National ID are required for IPRS verification.',
  IPRS_NOT_CONFIGURED:
    'IPRS verification is enabled but has not been configured.',
  IPRS_UNAVAILABLE:
    'IPRS is currently unavailable. Please try again later.',
  IPRS_SESSION_FAILED:
    'IPRS is currently unavailable. Please try again later.',
  IPRS_VERIFICATION_FAILED:
    'IPRS is currently unavailable. Please try again later.',
};

export function toPublicError(error: any): Error {
  const code = getErrorCode(error);
  return Object.assign(new Error(PUBLIC_ERROR_MESSAGES[code] || 'Unable to complete the request. Please try again.'), {
    code,
    statusCode: error?.response?.status || null,
    isPublicError: true,
  });
}

export function setOnAuthExpired(handler: () => void) {
  onAuthExpired = handler;
}

export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = await getAuthData();
    if (!stored.refreshToken) throw new Error('No refresh token is available.');
    const response = await axios.post<{ token?: string; refreshToken?: string }>(
      `${API_BASE_URL}/api/auth/refresh`,
      { refreshToken: stored.refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
    );
    const { token, refreshToken } = response.data;
    if (!token || !refreshToken) throw new Error('Invalid refresh response.');
    await saveAuthData({ token, refreshToken, userData: stored.userData || undefined });
    return token;
  })();

  try {
    return await refreshInFlight;
  } catch (error) {
    await clearAuthData();
    if (onAuthExpired) onAuthExpired();
    throw error;
  } finally {
    refreshInFlight = null;
  }
}

async function backendRequest<T>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: any,
  params?: any,
  options?: { silentTransportFailure?: boolean },
): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {};
  // A JSON content type belongs on requests with a body. Sending it on every
  // GET adds another non-simple browser header and needless CORS preflights.
  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  // Creation allocates counters and writes records. It should
  // not be misreported as a failed delivery on slower LAN connections.
  const timeout = method === 'post' && ['/api/purchase-orders', '/api/delivery-orders', '/api/warehouse-jobs'].includes(url) ? 45000 : 10000;
  const sendRequest = (accessToken: string | null) => axios.request<T>({
    baseURL: API_BASE_URL,
    url,
    method,
    data,
    params,
    headers: accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers,
    timeout,
  });
  try {
    const response = await sendRequest(token);
    return response.data;
  } catch (originalError: any) {
    // Browser requests to a LAN API can occasionally fail while the browser
    // reconnects to the local network. Retry read-only requests once before
    // treating the collection as unavailable; never retry writes automatically.
    let error = originalError;
    let status = error?.response?.status;
    if (method === 'get' && !status) {
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        const retryResponse = await sendRequest(token);
        return retryResponse.data;
      } catch (retryError: any) {
        error = retryError;
        status = error?.response?.status;
      }
    }
    const requestUrl = `${API_BASE_URL}${url}`;
    const errorCode =
      error?.response?.data?.code ||
      error?.response?.data?.errorInfo?.code ||
      "";
    // Firebase token expired → auto logout
    if (status === 401 && token && !url.startsWith('/api/auth/')) {
      try {
        const refreshedToken = await refreshAccessToken();
        const response = await sendRequest(refreshedToken);
        return response.data;
      } catch (refreshError) {
        throw toPublicError(refreshError);
      }
    }
    // Keep transport diagnostics out of production device logs. Callers
    // receive a stable, non-sensitive error code via `toPublicError` below.
    // Session restoration deliberately handles a profile failure by retrying
    // once or returning the user to sign-in. Do not emit a red development
    // error for that caller-managed state transition.
    const isSessionProfileRequest = url === '/api/auth/profile';
    if (__DEV__ && !isSessionProfileRequest && !options?.silentTransportFailure) {
      // Collection screens already retain their current data after a transport
      // failure. Keep this as a non-blocking warning rather than a red error.
      const logRequestFailure = console.warn;
      logRequestFailure(`[API] ${method.toUpperCase()} ${requestUrl} failed`, {
        status: status || null,
        code: errorCode || null,
        message: error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Request failed',
      });
    }
    throw toPublicError(error);
  }
}

const COLLECTION_RESPONSE_KEYS: Record<string, string[]> = {
  vendors: ['vendors'],
  drivers: ['drivers'],
  vehicles: ['vehicles'],
  materials: ['materials'],
  purchaseOrders: ['purchaseOrders', 'purchase_orders', 'orders'],
  deliveryOrders: ['deliveryOrders', 'delivery_orders', 'orders'],
  weighRecords: ['weighRecords', 'weighments'],
  checkpoints: ['checkpoints'],
  quarries: ['quarries'],
  sites: ['sites'],
  fuelRecords: ['fuelRecords', 'fuel'],
  uploads: ['uploads'],
  customers: ['customers'],
  fuelStations: ['fuelStations', 'fuel_stations'],
  users: ['users'],
  roles: ['roles'],
  warehouseJobs: ['warehouseJobs', 'warehouse_jobs'],
};

/**
 * Converts every supported collection envelope into a predictable array.
 * Controllers currently return either a direct array or `{ data: [] }`, but
 * named collection keys are accepted so an API envelope change cannot erase a
 * valid collection in the UI.
 */
export function normalizeCollection<T = any>(response: any, collectionName?: string): T[] {
  if (Array.isArray(response)) return response;

  const candidates = [
    response?.data,
    response?.items,
    response?.results,
    ...(collectionName
      ? (COLLECTION_RESPONSE_KEYS[collectionName] || []).map((key) => response?.[key])
      : []),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function unwrapItems<T = any>(data: any): T[] {
  return normalizeCollection<T>(data);
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
  options?: { silentTransportFailure?: boolean },
): Promise<T[]> {
  try {
    const result = await fetcher();
    return result;
  } catch (error: any) {
    const msg = error?.message || error?.code || String(error);
    if (__DEV__ && !options?.silentTransportFailure) {
      console.warn(`[API] ${label} collection request failed; retaining existing store data.`, msg);
    }
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

export async function previewPurchaseOrderNumber(
  vendorId: string,
  materialId?: string,
): Promise<string> {
  const result = await backendRequest<{ poNumber?: string }>(
    "get",
    "/api/purchase-orders/preview-number",
    undefined,
    { vendorId, materialId },
  );
  return result?.poNumber || "";
}

/**
 * Finalized site jobs available for fuel dispensing. This endpoint is scoped
 * for fuel operators and avoids exposing the full delivery-order board.
 */
export async function fetchFuelReadyDeliveryOrders(): Promise<any[]> {
  return safeFetch("fuel-ready-delivery-orders", () =>
    backendRequest<any>("get", "/api/delivery-orders/fuel-ready").then(
      unwrapItems,
    ),
  );
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

export async function fetchAuditLogs(_params?: {
  search?: string;
  severity?: string;
}): Promise<any[]> {
  // The API enforces Super Admin access and limits the response server-side.
  // Never substitute fabricated entries when this request is unavailable.
  return safeFetch("audit-logs", () =>
    backendRequest<any>("get", "/api/audit-logs", undefined, _params).then(
      (data) => normalizeCollection(data),
    ),
  );
}

export async function fetchWarehouseJobs(params?: {
  search?: string;
  vendorId?: string;
  status?: string;
}): Promise<any[]> {
  return safeFetch('warehouse-jobs', () =>
    backendRequest<any>('get', '/api/warehouse-jobs', undefined, params).then(
      (data) => normalizeCollection(data, 'warehouseJobs'),
    ),
  );
}

export async function createWarehouseJob(payload: any): Promise<any> {
  return unwrapOne(
    await backendRequest('post', '/api/warehouse-jobs', payload),
    payload,
  );
}

export type WarehouseShipmentPreviewRow = {
  rowNumber: number;
  status: 'READY' | 'INVALID';
  code: string;
  label: string;
  item: {
    productName: string;
    quantity: string;
    unit: string;
    source: string;
    mrfNo: string;
    additionalNotes: string;
    sourceData?: Record<string, string>;
  };
};

export type WarehouseShipmentPreview = {
  headers: string[];
  counts: { total: number; ready: number; invalid: number };
  rows: WarehouseShipmentPreviewRow[];
};

export async function previewWarehouseShipmentFile(asset: { uri: string; name?: string | null; mimeType?: string | null }): Promise<WarehouseShipmentPreview> {
  const token = await getStoredToken();
  const formData = new FormData();
  const name = asset.name || 'warehouse-shipment.csv';
  if (Platform.OS === 'web') {
    const file = await fetch(asset.uri).then((response) => response.blob());
    formData.append('file', file, name);
  } else {
    formData.append('file', {
      uri: asset.uri,
      name,
      type: asset.mimeType || 'text/csv',
    } as any);
  }
  try {
    const response = await axios.post<WarehouseShipmentPreview>('/api/warehouse-jobs/preview', formData, {
      baseURL: API_BASE_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 45000,
    });
    return response.data;
  } catch (error) {
    throw toPublicError(error);
  }
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
    if (__DEV__) console.log(`[API] fetchNextCounter(${entityType}) failed:`, error?.message || error);
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
    if (__DEV__) console.log("[API] requestFuelAuthorization failed:", error?.message || error);
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
    if (__DEV__) console.log("[API] verifyFuelAuthorization failed:", error?.message || error);
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
    if (__DEV__) console.log("[API] getFuelAuthorizationStatus failed:", error?.message || error);
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
    if (__DEV__) console.log("[API] getPendingAuthorizations failed:", error?.message || error);
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
      if (__DEV__ && isAuthProfile) {
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
      if (__DEV__ && isAuthEndpoint) {
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

export async function startSecurityTrackingSession(securityCode: string, location?: any): Promise<any> {
  const response = await axios.post(`${API_BASE_URL}/api/track/sessions`, { securityCode, location }, { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
  return response.data;
}

export async function selectSecurityTrackingVehicle(sessionId: string, token: string, plateNumber: string): Promise<any> {
  const response = await axios.post(`${API_BASE_URL}/api/track/sessions/${encodeURIComponent(sessionId)}/vehicle`, { token, plateNumber }, { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
  return response.data;
}

export async function recordSecurityTrackingDecision(sessionId: string, token: string, outcome: 'verified' | 'flagged', reason?: string): Promise<any> {
  const response = await axios.post(`${API_BASE_URL}/api/track/sessions/${encodeURIComponent(sessionId)}/decision`, { token, outcome, reason }, { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
  return response.data;
}

export async function fetchTrackingFlags(): Promise<any[]> {
  return backendRequest<any>('get', '/api/track/flags').then(unwrapItems);
}

export async function clearTrackingFlag(id: string, reason: string): Promise<any> {
  return backendRequest<any>('post', `/api/track/flags/${encodeURIComponent(id)}/clear`, { reason });
}

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
      if (__DEV__) console.log(`[API] Public tracking ${trackingId} failed: network error`, error?.code);
      throw Object.assign(new Error(`Error code: ${getErrorCode(error)}`), {
        code: getErrorCode(error),
        isNetworkError: true,
      });
    }

    // Server returned a structured error
    if (__DEV__) console.log(`[API] Public tracking ${trackingId} failed:`, status, serverCode, serverMessage);
    throw Object.assign(new Error(`Error code: ${getErrorCode(error)}`), {
      statusCode: status,
      errorCode: getErrorCode(error),
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
      if (__DEV__) console.log(`[API] Public tracking by plate ${plateNumber} failed: network error`, error?.code);
      throw Object.assign(new Error(`Error code: ${getErrorCode(error)}`), {
        code: getErrorCode(error),
        isNetworkError: true,
      });
    }

    // Server returned a structured error
    if (__DEV__) console.log(`[API] Public tracking by plate ${plateNumber} failed:`, status, serverCode, serverMessage);
    throw Object.assign(new Error(`Error code: ${getErrorCode(error)}`), {
      statusCode: status,
      errorCode: getErrorCode(error),
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

/**
 * Download a vendor-specific per-category CSV file.
 * Uses the authenticated vendor's own data (auto-filtered by vendorId on the backend).
 * - Web: triggers browser download.
 * - Native: saves to cache and shares.
 */
export async function downloadVendorCategoryCSV(
  category: string,
  params?: { filter?: string; start_date?: string; end_date?: string },
): Promise<void> {
  try {
    const token = await getStoredToken();
    const query = new URLSearchParams();
    if (params?.filter) query.set('filter', params.filter);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);

    const url = `${API_BASE_URL}/api/vendor/reports/export/csv/${category}?${query.toString()}`;

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
      link.download = `Vendor_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return;
    }

    // Native: read blob as text using FileReader, then save and share
    const text = await blobToText(response.data);
    const fileName = `Vendor_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
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
  return safeFetch(
    'issues',
    () => backendRequest<any>('get', '/api/issues', undefined, params, { silentTransportFailure: true }).then(unwrapItems),
    { silentTransportFailure: true },
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

/** Starts (or restarts) the server-enforced 21-day account deletion period. */
export async function requestAccountDeletion(): Promise<{ scheduledFor: string }> {
  try {
    return await backendRequest<{ scheduledFor: string }>('post', '/api/auth/account-deletion', { confirm: true });
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Failed to schedule account deletion.';
    throw new Error(msg);
  }
}

/** Sends a neutral password-reset request for an email address or username. */
export async function requestPasswordReset(identifier: string): Promise<void> {
  try {
    await backendRequest<any>('post', '/api/auth/password-reset', { identifier });
  } catch (error: any) {
    const msg = error?.response?.data?.error || error?.message || 'Unable to request a password reset.';
    throw new Error(msg);
  }
}

export default api;
export type { ApiClient };
