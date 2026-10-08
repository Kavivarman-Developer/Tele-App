import { Platform } from 'react-native';

/**
 * API Configuration
 *
 * NOTE FOR PHYSICAL PHONES:
 * When testing on a real phone via Wi-Fi, change this to your computer's local IP address
 * (e.g. 'http://192.168.1.100:5000/api').
 *
 * - Android Emulator uses: 'http://10.0.2.2:5000/api'
 * - Web / iOS Simulator uses: 'http://localhost:5000/api'
 */
const getDefaultApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getDefaultApiBaseUrl();
