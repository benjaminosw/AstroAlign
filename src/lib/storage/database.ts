/**
 * AstroAlign IndexedDB persistence core.
 *
 * Central module responsible for opening the database, creating object
 * stores, handling schema upgrades and exposing low-level read/write
 * operations. The rest of the application should never call
 * `indexedDB.open()` directly — it should go through this module or the
 * higher-level repository in `./repository.ts`.
 *
 * When IndexedDB is unavailable (e.g. some privacy modes) the app falls
 * back to a small in-memory backend so that it remains usable for the
 * current session (see `getPersistenceBackend`).
 */

export const DB_NAME = 'AstroAlignDB';
export const DB_VERSION = 1;

export const STORE_NAMES = [
  'targets',
  'shootingLocations',
  'shootingSetups',
  'savedAlignments',
  'appState'
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

export const APP_STATE_STORE: StoreName = 'appState';

/**
 * IndexedDB uses an inline key for each store. Entity stores are keyed by
 * `id`; the `appState` store is keyed by a stable string `key`.
 */
export function idbKeyPath(store: StoreName): string {
  return store === APP_STATE_STORE ? 'key' : 'id';
}

export class PersistenceError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PersistenceError';
    this.cause = cause;
  }
}

export class PersistenceUnavailableError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'PersistenceUnavailableError';
  }
}

export interface PersistenceBackend {
  readonly kind: 'indexeddb' | 'memory';
  getAll(_store: StoreName): Promise<Record<string, unknown>[]>;
  put(_store: StoreName, _record: Record<string, unknown>): Promise<void>;
  delete(_store: StoreName, _key: string): Promise<void>;
  clear(_store: StoreName): Promise<void>;
  clearAll(): Promise<void>;
  writeAll(_store: StoreName, _records: Record<string, unknown>[]): Promise<void>;
  close(): void;
}

function requestToPromise<T>(request: IDBRequest<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new PersistenceError(`${label} failed: ${request.error?.message ?? 'unknown error'}`, request.error));
  });
}

function transactionToPromise(tx: IDBTransaction, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(new PersistenceError(`${label} failed: ${tx.error?.message ?? 'transaction aborted'}`, tx.error));
    tx.onerror = () =>
      reject(new PersistenceError(`${label} failed: ${tx.error?.message ?? 'transaction error'}`, tx.error));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new PersistenceUnavailableError('IndexedDB is not available in this browser.', error));
      return;
    }

    request.onupgradeneeded = (_event) => {
      const db = request.result;
      // Create any missing object stores. Existing stores are preserved, so a
      // version bump in the future can add new stores without wiping data.
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: idbKeyPath(name) });
        }
      }
      // Future migrations should branch on `event.oldVersion` here, e.g.:
      // if (event.oldVersion < 2 && !db.objectStoreNames.contains('reminders')) {
      //   db.createObjectStore('reminders', { keyPath: 'id' });
      // }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new PersistenceUnavailableError(`Failed to open database: ${request.error?.message ?? 'unknown error'}`, request.error));
    request.onblocked = () =>
      reject(new PersistenceUnavailableError('Database upgrade was blocked by another open connection.'));
  });
}

class IndexedDbBackend implements PersistenceBackend {
  public readonly kind = 'indexeddb' as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase();
    }
    return this.dbPromise;
  }

  async getAll(store: StoreName): Promise<Record<string, unknown>[]> {
    const db = await this.getDb();
    const tx = db.transaction(store, 'readonly');
    const records = await requestToPromise<Record<string, unknown>[]>(tx.objectStore(store).getAll(), `Read ${store}`);
    return records;
  }

  async put(store: StoreName, record: Record<string, unknown>): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    await transactionToPromise(tx, `Write ${store}`);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await transactionToPromise(tx, `Delete ${store}`);
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await transactionToPromise(tx, `Clear ${store}`);
  }

  async clearAll(): Promise<void> {
    for (const store of STORE_NAMES) {
      await this.clear(store);
    }
  }

  async writeAll(store: StoreName, records: Record<string, unknown>[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    for (const record of records) {
      objectStore.put(record);
    }
    await transactionToPromise(tx, `Replace ${store}`);
  }

  close(): void {
    if (this.dbPromise) {
      this.dbPromise
        .then((db) => {
          try {
            db.close();
          } catch {
            // Ignore close errors.
          }
        })
        .catch(() => {
          // The open promise may have rejected; nothing to close.
        });
      this.dbPromise = null;
    }
  }
}

class MemoryBackend implements PersistenceBackend {
  public readonly kind = 'memory' as const;
  private readonly data = new Map<StoreName, Map<string, Record<string, unknown>>>();

  private storeMap(store: StoreName): Map<string, Record<string, unknown>> {
    let map = this.data.get(store);
    if (!map) {
      map = new Map();
      this.data.set(store, map);
    }
    return map;
  }

  async getAll(store: StoreName): Promise<Record<string, unknown>[]> {
    await Promise.resolve();
    return [...this.storeMap(store).values()];
  }

  async put(store: StoreName, record: Record<string, unknown>): Promise<void> {
    await Promise.resolve();
    const key = String(record[idbKeyPath(store)]);
    this.storeMap(store).set(key, record);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    await Promise.resolve();
    this.storeMap(store).delete(String(key));
  }

  async clear(store: StoreName): Promise<void> {
    await Promise.resolve();
    this.storeMap(store).clear();
  }

  async clearAll(): Promise<void> {
    await Promise.resolve();
    this.data.clear();
  }

  async writeAll(store: StoreName, records: Record<string, unknown>[]): Promise<void> {
    await Promise.resolve();
    const map = this.storeMap(store);
    map.clear();
    for (const record of records) {
      map.set(String(record[idbKeyPath(store)]), record);
    }
  }

  close(): void {
    // In-memory backend has no connection to close.
  }
}

let cachedBackend: PersistenceBackend | null = null;
let backendKind: PersistenceBackend['kind'] | null = null;

export function getPersistenceBackend(): PersistenceBackend {
  if (!cachedBackend) {
    if (typeof indexedDB !== 'undefined') {
      cachedBackend = new IndexedDbBackend();
      backendKind = 'indexeddb';
    } else {
      cachedBackend = new MemoryBackend();
      backendKind = 'memory';
    }
  }
  return cachedBackend;
}

export function getBackendKind(): PersistenceBackend['kind'] {
  return backendKind ?? (typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory');
}

function switchToMemoryBackend(): void {
  cachedBackend = new MemoryBackend();
  backendKind = 'memory';
}

/**
 * Runs an operation against the active backend. If the backend is
 * unavailable (IndexedDB blocked by the browser), switches to the in-memory
 * backend so the app keeps working for the current session.
 */
export async function runPersistenceOperation<T>(
  operation: (_backend: PersistenceBackend) => Promise<T>
): Promise<T> {
  const backend = getPersistenceBackend();
  try {
    return await operation(backend);
  } catch (error) {
    if (error instanceof PersistenceUnavailableError && getBackendKind() === 'indexeddb') {
      switchToMemoryBackend();
      return await operation(getPersistenceBackend());
    }
    throw error;
  }
}

export type PersistenceErrorListener = (_message: string) => void;

const errorListeners = new Set<PersistenceErrorListener>();

export function subscribeToPersistenceErrors(listener: PersistenceErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

export function reportPersistenceError(message: string): void {
  for (const listener of [...errorListeners]) {
    try {
      listener(message);
    } catch {
      // Listener failures must not break persistence.
    }
  }
}

/** Clears all persisted data and releases any cached connection. */
export async function resetPersistenceForTesting(): Promise<void> {
  const previous = cachedBackend;
  cachedBackend = null;
  backendKind = null;
  if (previous?.kind === 'indexeddb') {
    (previous as IndexedDbBackend).close();
  }
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.deleteDatabase(DB_NAME);
      } catch {
        resolve();
        return;
      }
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
  errorListeners.clear();
}
