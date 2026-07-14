import { Platform } from 'react-native';

function getEnvironmentName(): string {
  return __DEV__ ? 'Development' : 'Production';
}

export function getBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }

  return baseUrl.replace(/\/+$/, '');
}

export const API_BASE_URL = getBaseUrl();

export function logApiConfiguration(): void {
  console.log(
    [
      '[API]',
      `Environment: ${getEnvironmentName()}`,
      `Base URL: ${API_BASE_URL}`,
      `Network Status: ${Platform.OS}`,
    ].join('\n'),
  );
}
