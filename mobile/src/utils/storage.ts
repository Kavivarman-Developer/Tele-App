import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStore: Record<string, string> = {};
const CHUNK_SIZE = 1800; // SecureStore on Android has ~2048-byte limit per item

export const storage = {
  async getItem(key: string): Promise<string | null> {
    // 1. Fast in-memory check
    if (memoryStore[key] !== undefined) {
      return memoryStore[key];
    }

    // 2. Web storage
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          const val = localStorage.getItem(key);
          if (val !== null) memoryStore[key] = val;
          return val;
        }
      } catch {
        return null;
      }
      return null;
    }

    // 3. Native SecureStore with chunking support
    try {
      const chunksCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunksCountStr) {
        const count = parseInt(chunksCountStr, 10);
        if (!isNaN(count) && count > 0) {
          const chunks: string[] = [];
          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
            if (chunk) {
              chunks.push(chunk);
            }
          }
          const fullValue = chunks.join('');
          memoryStore[key] = fullValue;
          return fullValue;
        }
      }

      const directValue = await SecureStore.getItemAsync(key);
      if (directValue !== null) {
        memoryStore[key] = directValue;
      }
      return directValue;
    } catch (e) {
      console.warn(`[Storage] Failed to read key '${key}':`, e);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    // Always update in-memory cache immediately
    memoryStore[key] = value;

    // Web storage
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch {
        // Fallback to memoryStore
      }
      return;
    }

    // Native SecureStore with automatic chunking for arbitrary payload sizes
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        // Clear any leftover chunk markers
        await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
      } else {
        const count = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < count; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk);
        }
        await SecureStore.setItemAsync(`${key}__chunks`, String(count));
        // Remove single key to avoid stale small payload
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
    } catch (e) {
      console.warn(`[Storage] Failed to persist key '${key}' natively:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    delete memoryStore[key];

    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const chunksCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunksCountStr) {
        const count = parseInt(chunksCountStr, 10);
        if (!isNaN(count)) {
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`).catch(() => {});
          }
        }
        await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (e) {
      console.warn(`[Storage] Failed to remove key '${key}':`, e);
    }
  },
};
