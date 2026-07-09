/**
 * Upload Service
 *
 * Uploads images to the backend which stores them in Firebase Storage
 * and returns the public URL which is saved to Firestore as photoURL.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import { getStoredToken } from './database';

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (process.env.EXPO_PUBLIC_API_IP) return `http://${process.env.EXPO_PUBLIC_API_IP}:5000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://192.168.1.211:5000';
}

const API_BASE_URL = getBaseUrl();

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
  formData.append('file', {
    uri: fileUri,
    name: `${filename}.jpg`,
    type: 'image/jpeg',
  } as any);

  const response = await axios.post(`${API_BASE_URL}/api/uploads/${endpoint}`, formData, {
    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  return response.data;
}