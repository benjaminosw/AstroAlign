/**
 * Typed repository for AstroAlign persistent data.
 *
 * This is the only layer that reads/writes whole domain records to the
 * IndexedDB backend. UI components and contexts should use these functions
 * (via the application store) rather than touching `database.ts` directly.
 */

import type { SavedAlignment, SavedShootingLocation, SavedSetup, SavedTarget } from '../saved/types';
import {
  reportPersistenceError,
  runPersistenceOperation,
  STORE_NAMES,
  type PersistenceBackend
} from './database';
import {
  validateAppStateRecord,
  validateSavedAlignment,
  validateSetup,
  validateShootingLocation,
  validateTarget
} from './validation';

export interface HydratedData {
  targets: SavedTarget[];
  shootingLocations: SavedShootingLocation[];
  shootingSetups: SavedSetup[];
  savedAlignments: SavedAlignment[];
  appState: Record<string, unknown>;
}

export interface AppStateRecord {
  key: string;
  value: unknown;
}

async function writeOperation<T>(
  label: string,
  operation: (_backend: PersistenceBackend) => Promise<T>
): Promise<T> {
  try {
    return await runPersistenceOperation(operation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown persistence error';
    reportPersistenceError(`Unable to ${label}: ${message}`);
    throw error;
  }
}

export async function loadAllData(): Promise<HydratedData> {
  const empty: HydratedData = {
    targets: [],
    shootingLocations: [],
    shootingSetups: [],
    savedAlignments: [],
    appState: {}
  };
  try {
    const [targets, shootingLocations, shootingSetups, savedAlignments, appStateRecords] = await runPersistenceOperation(
      async (backend) =>
        Promise.all([
          backend.getAll('targets'),
          backend.getAll('shootingLocations'),
          backend.getAll('shootingSetups'),
          backend.getAll('savedAlignments'),
          backend.getAll('appState')
        ])
    );

    const validTargets: SavedTarget[] = [];
    for (const record of targets) {
      const error = validateTarget(record);
      if (error) {
        reportPersistenceError(`Skipping corrupted saved target: ${error}`);
      } else {
        validTargets.push(record as unknown as SavedTarget);
      }
    }

    const validLocations: SavedShootingLocation[] = [];
    for (const record of shootingLocations) {
      const error = validateShootingLocation(record);
      if (error) {
        reportPersistenceError(`Skipping corrupted shooting location: ${error}`);
      } else {
        validLocations.push(record as unknown as SavedShootingLocation);
      }
    }

    const validSetups: SavedSetup[] = [];
    for (const record of shootingSetups) {
      const error = validateSetup(record);
      if (error) {
        reportPersistenceError(`Skipping corrupted setup: ${error}`);
      } else {
        validSetups.push(record as unknown as SavedSetup);
      }
    }

    const validAlignments: SavedAlignment[] = [];
    for (const record of savedAlignments) {
      const error = validateSavedAlignment(record);
      if (error) {
        reportPersistenceError(`Skipping corrupted saved alignment: ${error}`);
      } else {
        validAlignments.push(record as unknown as SavedAlignment);
      }
    }

    const appState: Record<string, unknown> = {};
    for (const record of appStateRecords) {
      const error = validateAppStateRecord(record);
      if (error) {
        reportPersistenceError(`Skipping corrupted app state record: ${error}`);
        continue;
      }
      appState[(record as unknown as AppStateRecord).key] = (record as unknown as AppStateRecord).value;
    }

    return {
      targets: validTargets,
      shootingLocations: validLocations,
      shootingSetups: validSetups,
      savedAlignments: validAlignments,
      appState
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown persistence error';
    reportPersistenceError(`Unable to load saved data: ${message}`);
    return empty;
  }
}

export async function saveTarget(target: SavedTarget): Promise<void> {
  const validationError = validateTarget(target);
  if (validationError) {
    reportPersistenceError(`Not saving target: ${validationError}`);
    throw new Error(validationError);
  }
  await writeOperation('save target', (backend) => backend.put('targets', target as unknown as Record<string, unknown>));
}

export async function deleteTargetRecord(id: string): Promise<void> {
  await writeOperation('delete target', (backend) => backend.delete('targets', id));
}

export async function saveShootingLocation(location: SavedShootingLocation): Promise<void> {
  const validationError = validateShootingLocation(location);
  if (validationError) {
    reportPersistenceError(`Not saving shooting location: ${validationError}`);
    throw new Error(validationError);
  }
  await writeOperation('save shooting location', (backend) =>
    backend.put('shootingLocations', location as unknown as Record<string, unknown>)
  );
}

export async function deleteShootingLocationRecord(id: string): Promise<void> {
  await writeOperation('delete shooting location', (backend) => backend.delete('shootingLocations', id));
}

export async function saveSetup(setup: SavedSetup): Promise<void> {
  const validationError = validateSetup(setup);
  if (validationError) {
    reportPersistenceError(`Not saving setup: ${validationError}`);
    throw new Error(validationError);
  }
  await writeOperation('save setup', (backend) => backend.put('shootingSetups', setup as unknown as Record<string, unknown>));
}

export async function deleteSetupRecord(id: string): Promise<void> {
  await writeOperation('delete setup', (backend) => backend.delete('shootingSetups', id));
}

export async function saveSavedAlignment(alignment: SavedAlignment): Promise<void> {
  const validationError = validateSavedAlignment(alignment);
  if (validationError) {
    reportPersistenceError(`Not saving alignment: ${validationError}`);
    throw new Error(validationError);
  }
  await writeOperation('save alignment', (backend) =>
    backend.put('savedAlignments', alignment as unknown as Record<string, unknown>)
  );
}

export async function deleteSavedAlignmentRecord(id: string): Promise<void> {
  await writeOperation('delete alignment', (backend) => backend.delete('savedAlignments', id));
}

export async function saveAppStateRecord(key: string, value: unknown): Promise<void> {
  const record: AppStateRecord = { key, value };
  const validationError = validateAppStateRecord(record);
  if (validationError) {
    reportPersistenceError(`Not saving app state: ${validationError}`);
    throw new Error(validationError);
  }
  await writeOperation('save app state', (backend) =>
    backend.put('appState', record as unknown as Record<string, unknown>)
  );
}

export async function clearAllData(): Promise<void> {
  await writeOperation('clear saved data', (backend) => backend.clearAll());
}

export async function clearAppStateStore(): Promise<void> {
  await writeOperation('clear app state', (backend) => backend.clear('appState'));
}

export async function replaceAllData(data: HydratedData): Promise<void> {
  await writeOperation('replace saved data', async (backend) => {
    for (const store of STORE_NAMES) {
      await backend.clear(store);
    }
    await backend.writeAll('targets', data.targets as unknown as Record<string, unknown>[]);
    await backend.writeAll('shootingLocations', data.shootingLocations as unknown as Record<string, unknown>[]);
    await backend.writeAll('shootingSetups', data.shootingSetups as unknown as Record<string, unknown>[]);
    await backend.writeAll('savedAlignments', data.savedAlignments as unknown as Record<string, unknown>[]);
    await backend.writeAll(
      'appState',
      Object.entries(data.appState).map(([key, value]) => ({ key, value }))
    );
  });
}

export function toExportPayload(data: HydratedData): ExportPayload {
  return {
    app: 'AstroAlign',
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
}

export interface ExportPayload {
  app: string;
  version: number;
  exportedAt: string;
  data: HydratedData;
}

/**
 * Validates an imported JSON payload. Returns a list of problems; an empty
 * list means the payload is safe to import.
 */
export function validateImportPayload(payload: unknown): string[] {
  const problems: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return ['Import file does not contain a valid AstroAlign export.'];
  }
  const record = payload as Partial<ExportPayload>;
  if (record.app !== 'AstroAlign') {
    problems.push('Import file was not created by AstroAlign.');
  }
  if (typeof record.version !== 'number' || record.version < 1) {
    problems.push('Import file version is not supported.');
  }
  if (!record.data || typeof record.data !== 'object') {
    return [...problems, 'Import file has no data section.'];
  }
  const data = record.data as Partial<HydratedData>;
  const arrays = ['targets', 'shootingLocations', 'shootingSetups', 'savedAlignments'] as const;
  for (const kind of arrays) {
    const values = data[kind];
    if (values !== undefined && !Array.isArray(values)) {
      problems.push(`Imported ${kind} must be an array.`);
    }
  }
  if (data.appState !== undefined && (typeof data.appState !== 'object' || data.appState === null)) {
    problems.push('Imported appState must be an object.');
  }
  return problems;
}

export async function importData(payload: unknown): Promise<{ ok: boolean; problems: string[] }> {
  const problems = validateImportPayload(payload);
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  const record = payload as ExportPayload;
  const data: HydratedData = {
    targets: (record.data.targets ?? []).filter((item) => validateTarget(item) === null) as SavedTarget[],
    shootingLocations: (record.data.shootingLocations ?? []).filter(
      (item) => validateShootingLocation(item) === null
    ) as SavedShootingLocation[],
    shootingSetups: (record.data.shootingSetups ?? []).filter(
      (item) => validateSetup(item) === null
    ) as SavedSetup[],
    savedAlignments: (record.data.savedAlignments ?? []).filter(
      (item) => validateSavedAlignment(item) === null
    ) as SavedAlignment[],
    appState: {}
  };
  if (record.data.appState && typeof record.data.appState === 'object') {
    for (const [key, value] of Object.entries(record.data.appState)) {
      if (validateAppStateRecord({ key, value }) === null) {
        data.appState[key] = value;
      }
    }
  }
  await replaceAllData(data);
  return { ok: true, problems: [] };
}
