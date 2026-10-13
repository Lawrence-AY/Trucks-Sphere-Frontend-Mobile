/**
 * Counter Service — Frontend wrapper for the backend sequential counter API.
 * Used for generating sequential Receipt Note IDs and other entity IDs.
 */
import axios from 'axios';
import { getStoredToken } from './database';
import { API_BASE_URL } from './config';

export async function getNextId(): Promise<string> {
  const token = await getStoredToken();
  const response = await axios.get<{ id: string }>('/api/counter/receipt_note', {
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 5000,
  });
  return response.data.id;
}
