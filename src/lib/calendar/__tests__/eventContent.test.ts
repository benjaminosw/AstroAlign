import { describe, expect, it } from 'vitest';
import type { SavedAlignment } from '../../saved/types';
import {
  buildCalendarEventFields,
  calendarEventDescription,
  calendarEventLocation,
  calendarEventTitle,
  effectiveAlignmentTimeZone
} from '../eventContent';

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

describe('effectiveAlignmentTimeZone', () => {
  it('uses the saved timezone when present', () => {
    expect(effectiveAlignmentTimeZone(makeAlignment({ timeZone: 'Asia/Singapore' }))).toBe('Asia/Singapore');
  });

  it('derives the timezone from the observer snapshot when no timezone is stored', () => {
    const alignment = makeAlignment({
      timeZone: null,
      observerSnapshot: { latitude: 1.31, longitude: 103.88 }
    });
    expect(effectiveAlignmentTimeZone(alignment)).toBe('Asia/Singapore');
  });

  it('falls back to UTC when no timezone or coordinates exist', () => {
    expect(effectiveAlignmentTimeZone(makeAlignment({ timeZone: null }))).toBe('UTC');
  });
});

describe('calendarEventTitle', () => {
  it('prefixes the label with the moon phase emoji and appends the target name', () => {
    const alignment = makeAlignment({
      object: 'Moon',
      moonPhase: { name: 'Full Moon', emoji: '🌕', phaseAngle: 180, illuminationPercent: 100 }
    });
    expect(calendarEventTitle(alignment, 'Tower A')).toBe('🌕 Moonrise — Tower A');
  });

  it('uses the object name for direct alignments (event null)', () => {
    const alignment = makeAlignment({ event: null });
    expect(calendarEventTitle(alignment, 'Tower A')).toBe('Sun — Tower A');
  });

  it('falls back to AstroAlign alignment when no target name is available', () => {
    expect(calendarEventTitle(makeAlignment(), null)).toBe('Sunrise — AstroAlign alignment');
  });
});

describe('calendarEventDescription', () => {
  it('includes the header, formatted date, time, and coordinates', () => {
    const alignment = makeAlignment({
      toleranceDegrees: 1,
      observerSnapshot: { latitude: 1.31, longitude: 103.88 },
      targetSnapshot: { latitude: 1.4, longitude: 104.0 },
      shootingPositionSnapshot: {
        latitude: 1.32,
        longitude: 103.9,
        bearingToTarget: 90,
        alignmentError: 0.5,
        distanceFromStartKm: 2,
        zoneStartKm: 1,
        zoneEndKm: 3
      }
    });
    const description = calendarEventDescription(alignment, 'Tower A');

    expect(description).toContain('ASTROALIGN ALIGNMENT');
    expect(description).toContain('Target: Tower A');
    expect(description).toContain('Object: Sun');
    expect(description).toContain('Event: Sunrise');
    expect(description).toContain('Date: 01/08/2027');
    expect(description).toContain('Time: 07:00:00');
    expect(description).toContain('Tolerance: 1.00°');
    expect(description).toContain('Observer: 1.310000, 103.880000');
    expect(description).toContain('Target: 1.400000, 104.000000');
    expect(description).toContain('Shooting position: 1.320000, 103.900000');
    expect(description).toContain('Position along corridor: 2.00 km from start');
    expect(description).toContain('Valid zone: 1.00–3.00 km from start');
  });

  it('includes the moon phase when present', () => {
    const alignment = makeAlignment({
      moonPhase: { name: 'New Moon', emoji: '🌑', phaseAngle: 0, illuminationPercent: 0 }
    });
    expect(calendarEventDescription(alignment, null)).toContain('Moon phase: New Moon (🌑, 0.0% illuminated)');
  });
});

describe('calendarEventLocation', () => {
  it('prefers the shooting position over the observer', () => {
    const alignment = makeAlignment({
      observerSnapshot: { latitude: 1.31, longitude: 103.88 },
      shootingPositionSnapshot: { latitude: 1.32, longitude: 103.9, bearingToTarget: 90, alignmentError: 0.5 }
    });
    expect(calendarEventLocation(alignment)).toBe('1.320000, 103.900000');
  });

  it('uses the observer location when no shooting position exists', () => {
    const alignment = makeAlignment({ observerSnapshot: { latitude: 1.31, longitude: 103.88 } });
    expect(calendarEventLocation(alignment)).toBe('1.310000, 103.880000');
  });

  it('returns null when there are no coordinates', () => {
    expect(calendarEventLocation(makeAlignment())).toBeNull();
  });
});

describe('buildCalendarEventFields', () => {
  it('builds a 5-minute event ending after the start', () => {
    const fields = buildCalendarEventFields(makeAlignment({ timeZone: 'UTC' }), 'Tower A', 5, 30);
    const start = new Date(fields.start).getTime();
    const end = new Date(fields.end).getTime();
    expect(end - start).toBe(5 * 60 * 1000);
    expect(fields.timeZone).toBe('UTC');
    expect(fields.reminderMinutes).toBe(30);
    expect(fields.title).toBe('Sunrise — Tower A');
  });

  it('converts a non-UTC local time to the correct UTC instant', () => {
    const fields = buildCalendarEventFields(
      makeAlignment({ timeZone: 'Asia/Singapore' }),
      null,
      5,
      0
    );
    // 2027-08-01 07:00:00 +08 = 2027-07-31 23:00:00 UTC
    expect(fields.start).toBe('2027-07-31T23:00:00.000Z');
  });
});
