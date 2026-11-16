/**
 * Service: Storage
 *
 * Responsibilities:
 * - Persistent local device key-value storage for settings, recent tracks, and cached metadata.
 * - Abstracted to allow switching between AsyncStorage or high-performance local storage.
 *
 * Status: Interface defined.
 */

export interface StorageService {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}
