import { describe, expect, it } from 'vitest';
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  idbKeyPath,
  getBackendKind,
  getPersistenceBackend
} from '../database';

/**
 * Opens the database with a simulated future schema (version + 1) that adds a
 * "reminders" store. Mirrors the production upgrade logic of creating only the
 * stores that are missing.
 */
function openFutureVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      const futureStores = [...STORE_NAMES, 'reminders'];
      for (const name of futureStores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: idbKeyPath(name as (typeof STORE_NAMES)[number]) });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function validTarget(): Record<string, unknown> {
  return {
    id: 'target-1',
    name: 'Tower A',
    latitude: 1.31,
    longitude: 103.88,
    elevation: 12,
    notes: '',
    createdAt: '2027-08-01T00:00:00.000Z',
    updatedAt: '2027-08-01T00:00:00.000Z'
  };
}

describe('AstroAlign persistence database', () => {
  it('uses the expected database name and version', () => {
    expect(DB_NAME).toBe('AstroAlignDB');
    expect(DB_VERSION).toBe(1);
  });

  it('creates every expected store with the correct key path', async () => {
    const backend = getPersistenceBackend();
    expect(getBackendKind()).toBe('indexeddb');
    await backend.getAll('targets');

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const storeNames = [...db.objectStoreNames];
    for (const store of STORE_NAMES) {
      expect(storeNames).toContain(store);
      expect(db.transaction(store).objectStore(store).keyPath).toBe(idbKeyPath(store));
    }
    db.close();
  });

  it('writes and reads records through the backend', async () => {
    const backend = getPersistenceBackend();
    await backend.put('targets', validTarget());
    const records = await backend.getAll('targets');
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('target-1');
  });

  it('deletes and clears records through the backend', async () => {
    const backend = getPersistenceBackend();
    await backend.put('targets', validTarget());
    await backend.delete('targets', 'target-1');
    expect(await backend.getAll('targets')).toHaveLength(0);

    await backend.put('targets', validTarget());
    await backend.put('appState', { key: 'app.activeTab', value: 'find' });
    await backend.clearAll();
    for (const store of STORE_NAMES) {
      expect(await backend.getAll(store)).toHaveLength(0);
    }
  });

  it('upgrades to a future version by adding missing stores without wiping existing data', async () => {
    const backend = getPersistenceBackend();
    await backend.put('targets', validTarget());
    await backend.put('appState', { key: 'app.activeTab', value: 'find' });
    backend.close();

    const db = await openFutureVersion(DB_VERSION + 1);

    expect(db.objectStoreNames.contains('targets')).toBe(true);
    expect(db.objectStoreNames.contains('appState')).toBe(true);
    expect(db.objectStoreNames.contains('reminders')).toBe(true);

    const records = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('targets', 'readonly').objectStore('targets').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(records).toEqual(['target-1']);

    const appStateRecords = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('appState', 'readonly').objectStore('appState').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(appStateRecords).toEqual([{ key: 'app.activeTab', value: 'find' }]);
    db.close();
  });
});
