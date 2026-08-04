import { Platform } from 'react-native';
import axios from 'axios';
import { getStoredToken } from './database';
import { API_BASE_URL } from './config';
import { toPublicError } from './api';

export type BulkImportType = 'drivers' | 'vehicles' | 'vendors';

export type CsvAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

export type ImportRow = {
  rowNumber: number;
  status: 'READY' | 'SKIPPED' | 'INVALID' | 'IMPORTED';
  code: string;
  label: string;
};

export type ImportPreview = {
  type: BulkImportType;
  headers: string[];
  counts: { total: number; ready: number; skipped: number; invalid: number };
  rows: ImportRow[];
};

export type ImportResult = {
  type: BulkImportType;
  counts: { total: number; imported: number; skipped: number; invalid: number };
  rows: ImportRow[];
};

async function createPayload(type: BulkImportType, asset: CsvAsset): Promise<FormData> {
  const formData = new FormData();
  const name = asset.name || `${type}.csv`;
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
  formData.append('type', type);
  return formData;
}

async function uploadCsv<T>(path: 'preview' | 'commit', type: BulkImportType, asset: CsvAsset): Promise<T> {
  const token = await getStoredToken();
  const data = await createPayload(type, asset);
  try {
    const response = await axios.post<T>(`/api/bulk-imports/${path}`, data, {
      baseURL: API_BASE_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 45000,
    });
    return response.data;
  } catch (error) {
    throw toPublicError(error);
  }
}

export function previewBulkImport(type: BulkImportType, asset: CsvAsset) {
  return uploadCsv<ImportPreview>('preview', type, asset);
}

export function commitBulkImport(type: BulkImportType, asset: CsvAsset) {
  return uploadCsv<ImportResult>('commit', type, asset);
}
