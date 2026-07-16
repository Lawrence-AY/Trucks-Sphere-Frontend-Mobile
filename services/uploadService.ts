/**
 * Upload Service
 *
 * Uploads images to the backend which stores them in Firebase Storage
 * and returns the public URL which is saved to Firestore as photoURL.
 */
import { Platform } from 'react-native';
import axios, { AxiosError } from 'axios';
import { getStoredToken } from './database';
import { API_BASE_URL } from './config';
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface UploadResult {
  success: boolean;
  photoURL: string;
}

/**
 * Extract a human-readable error message from an Axios error,
 * falling back to the generic Error.message.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    // No response from server (network down, wrong IP, timeout)
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return 'Upload timed out. Please check your connection and try again.';
      return 'Cannot reach the server. Please check your internet connection.';
    }

    const { status, data } = error.response;

    // Try to pull the meaningful error from the backend response body
    const backendError =
      data?.error ||
      data?.message ||
      (typeof data === 'string' ? data : null);

    if (backendError) {
      // Include status code so the user knows if it's auth vs server vs validation
      return `[${status}] ${backendError}`;
    }

    // No structured error from backend — use HTTP status text
    return `[${status}] ${error.response.statusText || 'Upload failed'}`;
  }

  // Non-Axios error (unlikely but handle it)
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred during upload.';
}

/**
 * Upload a driver profile photo.
 * Storage folder: "Drivers PP/"
 * Firestore field: drivers/{driverId}.photoURL
 */
export async function uploadDriverPhoto(driverId: string, fileUri: string): Promise<UploadResult> {
  return uploadFile(
    `driver-photo/${driverId}`,
    fileUri,
    'photo',
    `driver-${driverId}`
  );
}

/**
 * Upload a delivery note image.
 * Storage folder: "Deliverynotes/"
 * Firestore field: deliveryOrders/{deliveryOrderId}.photoURL
 */
export async function uploadDeliveryNote(deliveryOrderId: string, fileUri: string): Promise<UploadResult> {
  return uploadFile(
    `delivery-note/${deliveryOrderId}`,
    fileUri,
    'note',
    `delivery-${deliveryOrderId}`
  );
}

/**
 * Upload a receipt note image.
 * Storage folder: "Receipt note/"
 * Firestore field: weighRecords/{weighRecordId}.photoURL
 */
export async function uploadReceiptNote(weighRecordId: string, fileUri: string): Promise<UploadResult> {
  return uploadFile(
    `receipt-note/${weighRecordId}`,
    fileUri,
    'receipt',
    `receipt-${weighRecordId}`
  );
}

/**
 * Upload a driver photo captured at weigh-out.
 * Storage folder: "Deliveries/"
 * Filename: {jobId}.jpg (e.g. PMAT001_V001_D001_T001.jpg)
 * Firestore field: deliveryOrders/{deliveryOrderId}.driverPhotoURL
 */
export async function uploadDriverPhotoWeighOut(jobId: string, fileUri: string): Promise<UploadResult> {
  return uploadFile(
    `driver-photo-weigh-out/${jobId}`,
    fileUri,
    'file',
    jobId
  );
}

/**
 * Upload a fuel pump photo.
 * Storage folder: "Fuel pump/"
 * Filename: {jobId}.jpg
 * Firestore field: fuelRecords/{fuelId}.pumpPhotoURL
 */
export async function uploadFuelPumpPhoto(jobId: string, fileUri: string): Promise<UploadResult> {
  return uploadFile(
    `fuel-pump-photo/${jobId}`,
    fileUri,
    'file',
    `fuel-pump-${jobId}`
  );
}

async function uploadFile(
  endpoint: string,
  fileUri: string,
  fileFieldName: string,
  filename: string
): Promise<UploadResult> {
  const headers = await getAuthHeaders();
  // multipart/form-data — let axios set Content-Type with boundary
  delete headers['Content-Type'];

  const formData = new FormData();

  // On web, expo-image-picker camera returns blob: URLs.
  // React Native's { uri, name, type } object format is NOT understood
  // by the browser's native FormData API — the blob must be fetched and
  // appended directly. Without this, multer receives no file and returns
  // 400 {"error":"No file provided"}.
  if (Platform.OS === 'web' && (fileUri.startsWith('blob:') || fileUri.startsWith('data:'))) {
    const blob: Blob = await fetch(fileUri).then((r) => r.blob());
    formData.append('file', blob, `${filename}.jpg`);
  } else {
    // Native (iOS / Android): React Native's networking layer understands
    // { uri, name, type } and will stream the file from disk.
    formData.append('file', {
      uri: fileUri,
      name: `${filename}.jpg`,
      type: 'image/jpeg',
    } as any);
  }

  const url = `/api/uploads/${endpoint}`;

  try {
    const response = await axios.post(url, formData, {
      baseURL: API_BASE_URL,
      headers: { ...headers },
      timeout: 30000,
    });

    return response.data;
  } catch (error: unknown) {
    // Log full error details to console for debugging

    if (error instanceof AxiosError) {
      if (error.response) {
      } else if (error.request) {
      } else {
      }
    } else if (error instanceof Error) {
    } else {
    }

    // Throw a new Error with a meaningful message that the UI can display
    throw new Error(extractErrorMessage(error));
  }
}
