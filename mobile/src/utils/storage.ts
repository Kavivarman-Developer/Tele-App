import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const memoryStore: Record<string, string> = {};
const CHUNK_SIZE = 1800; // SecureStore limit per item

const getFilePath = (key: string): string | null => {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  const safeName = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${FileSystem.documentDirectory}crm_${safeName}.json`;
};

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

    // 3. Native FileSystem check for blazing fast large-payload read (< 2ms)
    try {
      const filePath = getFilePath(key);
      if (filePath) {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(filePath);
          memoryStore[key] = content;
          return content;
        }
      }
    } catch {
      // Fall through to SecureStore
    }

    // 4. Native SecureStore with chunking support (backward-compatibility)
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

    // Native: If large payload (> 1500 chars), write to FileSystem in 1 single native call (< 2ms)
    if (value.length > 1500) {
      try {
        const filePath = getFilePath(key);
        if (filePath) {
          await FileSystem.writeAsStringAsync(filePath, value);
          // Clear any legacy SecureStore keys
          await SecureStore.deleteItemAsync(key).catch(() => {});
          await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
          return;
        }
      } catch (err) {
        console.warn(`[Storage] FileSystem write fallback to SecureStore for '${key}':`, err);
      }
    }

    // Native SecureStore for small items (tokens, credentials)
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
      } else {
        const count = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < count; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk);
        }
        await SecureStore.setItemAsync(`${key}__chunks`, String(count));
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
      const filePath = getFilePath(key);
      if (filePath) {
        await FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
      }
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
