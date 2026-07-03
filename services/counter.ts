/**
 * Counter Service — Frontend wrapper for the backend sequential counter API.
 * Used for generating sequential Receipt Note IDs and other entity IDs.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import { getStoredToken } from './database';

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (process.env.EXPO_PUBLIC_API_IP) return `http://${process.env.EXPO_PUBLIC_API_IP}:5000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://192.168.1.4:5000';
}

const API_BASE_URL = getBaseUrl();

export async function getNextId(): Promise<string> {
  const token = await getStoredToken();
  const response = await axios.get<{ id: string }>(`${API_BASE_URL}/api/counter/receipt_note`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 5000,
  });
  return response.data.id;
}