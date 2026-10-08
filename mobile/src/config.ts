import { Platform } from 'react-native';

/**
 * API Configuration
 *
 * Production / Live Backend URL:
 * https://tele-app-n9wu.onrender.com/api
 */
const getDefaultApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://tele-app-n9wu.onrender.com/api';
};

export const API_BASE_URL = getDefaultApiBaseUrl();
