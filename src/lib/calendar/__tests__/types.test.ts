import { describe, expect, it } from 'vitest';
import type { SavedAlignment } from '../../saved/types';
import { calendarSyncStatus } from '../types';

function makeAlignment(overrides: Partial<SavedAlignment> = {}): SavedAlignment {
  return {
    id: 'align-1',
    name: 'Sunrise · 01/08/2027 · 07:00:00 · 0.50°',
    dedupeKey: 'finder|Sun|rise|2027-08-01|07:00:00|90.000',
    source: 'finder',
    object: 'Sun',
    event: 'rise',
    date: '2027-08-01',
    time: '07:00:00',
    timeZone: 'UTC',
    celestialAzimuth: 90,
    targetBearing: 89.5,
    alignmentError: 0.5,
    toleranceDegrees: 1,
    withinTolerance: true,
    moonPhase: null,
    observerSnapshot: null,
    targetSnapshot: null,
    shootingPositionSnapshot: null,
    shootingLocationSnapshot: null,
    createdAt: '2027-08-01T00:00:00.000Z',
    updatedAt: '2027-08-01T00:00:00.000Z',
    ...overrides
  };
}

const integration = {
  calendarId: 'primary',
  eventId: 'event-1',
  eventUrl: null,
  lastSyncedAt: '2027-08-02T00:00:00.000Z'
};

describe('calendarSyncStatus', () => {
  it('returns not-connected when the provider is not connected', () => {
    const alignment = makeAlignment({ calendarIntegrations: { google: integration } });
    expect(calendarSyncStatus(alignment, 'google', false)).toBe('not-connected');
    expect(calendarSyncStatus(alignment, 'microsoft', false)).toBe('not-connected');
  });

  it('returns not-exported when connected but the alignment has no integration', () => {
    expect(calendarSyncStatus(makeAlignment(), 'google', true)).toBe('not-exported');
  });

  it('returns exported when the last sync is after the last alignment update', () => {
    const alignment = makeAlignment({ calendarIntegrations: { google: integration } });
    expect(calendarSyncStatus(alignment, 'google', true)).toBe('exported');
  });

  it('returns out-of-sync when the alignment was updated after the last sync', () => {
    const alignment = makeAlignment({
      updatedAt: '2027-08-03T00:00:00.000Z',
      calendarIntegrations: { google: integration }
    });
    expect(calendarSyncStatus(alignment, 'google', true)).toBe('out-of-sync');
  });

  it('returns out-of-sync when timestamps cannot be parsed', () => {
    const alignment = makeAlignment({
      updatedAt: 'not-a-date',
      calendarIntegrations: { google: integration }
    });
    expect(calendarSyncStatus(alignment, 'google', true)).toBe('out-of-sync');
  });

  it('only inspects the requested provider', () => {
    const alignment = makeAlignment({ calendarIntegrations: { microsoft: integration } });
    expect(calendarSyncStatus(alignment, 'google', true)).toBe('not-exported');
    expect(calendarSyncStatus(alignment, 'microsoft', true)).toBe('exported');
  });
});
