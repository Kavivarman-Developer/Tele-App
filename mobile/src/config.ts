import { Platform } from 'react-native';

/**
 * API Configuration
 *
 * Production / Live Backend URL:
 * https://call.okboz.co.in/api
 */
const getDefaultApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://call.okboz.co.in/api';
};

export const API_BASE_URL = getDefaultApiBaseUrl();
