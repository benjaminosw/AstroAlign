import { describe, expect, it } from 'vitest';
import type { SavedAlignment, SavedSetup, SavedShootingLocation, SavedTarget } from '../../saved/types';
import {
  clearAllData,
  deleteSavedAlignmentRecord,
  importData,
  loadAllData,
  replaceAllData,
  saveAppStateRecord,
  saveSavedAlignment,
  saveSetup,
  saveShootingLocation,
  saveTarget,
  toExportPayload,
  validateImportPayload
} from '../repository';
import { getPersistenceBackend, subscribeToPersistenceErrors } from '../database';

function makeTarget(overrides: Partial<SavedTarget> = {}): SavedTarget {
  return {
    id: 'target-1',
    name: 'Tower A',
    latitude: 1.31,
    longitude: 103.88,
    elevation: 12,
    notes: 'Roof access',
    createdAt: '2027-08-01T00:00:00.000Z',
    updatedAt: '2027-08-01T00:00:00.000Z',
    ...overrides
  };
}

function makeLocation(overrides: Partial<SavedShootingLocation> = {}): SavedShootingLocation {
  return {
    id: 'location-1',
    name: 'East Coast Park',
    notes: '',
    createdAt: '2027-08-02T00:00:00.000Z',
    updatedAt: '2027-08-02T00:00:00.000Z',
    geometry: {
      type: 'path',
      start: { id: 's', name: 'Start', latitude: 1.3, longitude: 103.9 },
      end: { id: 'e', name: 'End', latitude: 1.4, longitude: 104.0 }
    },
    ...overrides
  };
}

function makeSetup(overrides: Partial<SavedSetup> = {}): SavedSetup {
  return {
    id: 'setup-1',
    name: 'Tower A · East Coast Park',
    targetId: 'target-1',
    shootingLocationId: 'location-1',
    createdAt: '2027-08-03T00:00:00.000Z',
    updatedAt: '2027-08-03T00:00:00.000Z',
    ...overrides
  };
}

function makeAlignment(overrides: Partial<SavedAlignment> = {}): SavedAlignment {
  return {
    id: 'alignment-1',
    name: 'Sunrise · 01/08/2027 · 07:00:00 · 0.50°',
    dedupeKey: 'finder|Sun|rise|2027-08-01|07:00:00|90.000',
    targetId: 'target-1',
    shootingSetupId: null,
    source: 'finder',
    object: 'Sun',
    event: 'rise',
    date: '2027-08-01',
    time: '07:00:00',
    timeZone: 'Asia/Singapore',
    celestialAzimuth: 90,
    targetBearing: 89.5,
    alignmentError: 0.5,
    toleranceDegrees: 1,
    withinTolerance: true,
    moonPhase: null,
    observerSnapshot: { latitude: 1.3, longitude: 103.8, elevation: 10, name: null },
    targetSnapshot: { latitude: 1.31, longitude: 103.88, elevation: 12, name: 'Tower A' },
    shootingPositionSnapshot: null,
    shootingLocationSnapshot: null,
    createdAt: '2027-08-01T00:00:00.000Z',
    updatedAt: '2027-08-01T00:00:00.000Z',
    ...overrides
  };
}

describe('repository', () => {
  it('saves and loads targets, locations, setups, alignments, and app state', async () => {
    const target = makeTarget();
    const location = makeLocation();
    const setup = makeSetup();
    const alignment = makeAlignment();

    await saveTarget(target);
    await saveShootingLocation(location);
    await saveSetup(setup);
    await saveSavedAlignment(alignment);
    await saveAppStateRecord('app.activeTab', 'find');

    const data = await loadAllData();
    expect(data.targets).toEqual([target]);
    expect(data.shootingLocations).toEqual([location]);
    expect(data.shootingSetups).toEqual([setup]);
    expect(data.savedAlignments).toEqual([alignment]);
    expect(data.appState['app.activeTab']).toBe('find');
  });

  it('deletes records and clears all data', async () => {
    await saveTarget(makeTarget());
    await saveSavedAlignment(makeAlignment());
    await deleteSavedAlignmentRecord('alignment-1');

    const afterDelete = await loadAllData();
    expect(afterDelete.savedAlignments).toHaveLength(0);
    expect(afterDelete.targets).toHaveLength(1);

    await clearAllData();
    const cleared = await loadAllData();
    expect(cleared.targets).toHaveLength(0);
    expect(cleared.shootingLocations).toHaveLength(0);
    expect(cleared.shootingSetups).toHaveLength(0);
    expect(cleared.savedAlignments).toHaveLength(0);
    expect(cleared.appState).toEqual({});
  });

  it('skips corrupted records on load and reports the problem', async () => {
    const reported: string[] = [];
    const unsubscribe = subscribeToPersistenceErrors((message) => reported.push(message));

    const backend = getPersistenceBackend();
    await backend.put('targets', makeTarget() as unknown as Record<string, unknown>);
    await backend.put('targets', {
      id: 'broken',
      name: 'No coordinates',
      createdAt: 'not-a-date',
      updatedAt: 'also-not-a-date'
    });

    const data = await loadAllData();
    expect(data.targets).toHaveLength(1);
    expect(data.targets[0].id).toBe('target-1');
    expect(reported.some((message) => message.includes('Skipping corrupted saved target'))).toBe(true);
    unsubscribe();
  });

  it('rejects saving an invalid target', async () => {
    await expect(saveTarget(makeTarget({ latitude: 999 }))).rejects.toThrow(/invalid coordinates/i);
    const data = await loadAllData();
    expect(data.targets).toHaveLength(0);
  });

  it('round-trips data through export and import', async () => {
    await saveTarget(makeTarget());
    await saveAppStateRecord('app.activeTab', 'calculate');

    const exported = toExportPayload(await loadAllData());
    expect(exported.app).toBe('AstroAlign');
    expect(exported.version).toBe(1);

    await clearAllData();
    const empty = await loadAllData();
    expect(empty.targets).toHaveLength(0);

    const result = await importData(exported);
    expect(result.ok).toBe(true);

    const restored = await loadAllData();
    expect(restored.targets).toHaveLength(1);
    expect(restored.targets[0].name).toBe('Tower A');
    expect(restored.appState['app.activeTab']).toBe('calculate');
  });

  it('rejects an import payload that is not an AstroAlign export', async () => {
    const result = await importData({ app: 'Something Else', version: 1, data: { targets: [] } });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(validateImportPayload('not-an-object')).not.toEqual([]);
  });

  it('replaces all data atomically-ish via replaceAllData', async () => {
    await replaceAllData({
      targets: [makeTarget()],
      shootingLocations: [makeLocation()],
      shootingSetups: [makeSetup()],
      savedAlignments: [makeAlignment()],
      appState: { 'app.target': { latitude: 2, longitude: 100, elevation: 0 } }
    });

    const data = await loadAllData();
    expect(data.targets).toHaveLength(1);
    expect(data.savedAlignments).toHaveLength(1);
    expect(data.appState['app.target']).toEqual({ latitude: 2, longitude: 100, elevation: 0 });
  });
});
