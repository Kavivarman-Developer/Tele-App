import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStore: Record<string, string> = {};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
      } catch {
        return memoryStore[key] || null;
      }
      return memoryStore[key] || null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return;
        }
      } catch {
        memoryStore[key] = value;
        return;
      }
      memoryStore[key] = value;
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn(`[Storage] Failed to save key '${key}' securely:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
          return;
        }
      } catch {
        delete memoryStore[key];
        return;
      }
      delete memoryStore[key];
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn(`[Storage] Failed to delete key '${key}':`, e);
    }
  },
};
