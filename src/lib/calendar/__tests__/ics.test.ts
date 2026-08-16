import { describe, expect, it } from 'vitest';
import type { SavedAlignment } from '../../saved/types';
import { buildIcsCalendar, reminderTriggerIcs } from '../ics';

function makeAlignment(overrides: Partial<SavedAlignment> = {}): SavedAlignment {
  return {
    id: 'align-1',
    name: 'Sunrise 2027',
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

describe('reminderTriggerIcs', () => {
  it('maps minute counts to ICS triggers', () => {
    expect(reminderTriggerIcs(0)).toBeNull();
    expect(reminderTriggerIcs(5)).toBe('-PT5M');
    expect(reminderTriggerIcs(30)).toBe('-PT30M');
    expect(reminderTriggerIcs(60)).toBe('-PT60M');
    expect(reminderTriggerIcs(1440)).toBe('-P1D');
    expect(reminderTriggerIcs(10080)).toBe('-P1W');
  });
});

describe('buildIcsCalendar', () => {
  it('produces a minimal RFC 5545 file with correct start and summary', () => {
    const { fileName, content } = buildIcsCalendar(makeAlignment(), null, 30);

    expect(fileName).toBe('Sunrise 2027.ics');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('VERSION:2.0');
    expect(content).toContain('PRODID:-//AstroAlign//AstroAlign Calendar Export//EN');
    expect(content).toContain('BEGIN:VEVENT');
    expect(content).toContain('UID:align-1@astroalign');
    expect(content).toContain('DTSTART:20270801T070000Z');
    expect(content).toContain('DTEND:20270801T070500Z');
    expect(content).toContain('SUMMARY:Sunrise — AstroAlign alignment');
    expect(content).toContain('END:VEVENT');
    expect(content).toContain('END:VCALENDAR');
  });

  it('includes a VALARM when a reminder is configured and omits it otherwise', () => {
    const withReminder = buildIcsCalendar(makeAlignment(), null, 30).content;
    expect(withReminder).toContain('BEGIN:VALARM');
    expect(withReminder).toContain('TRIGGER:-PT30M');
    expect(withReminder).toContain('ACTION:DISPLAY');

    const withoutReminder = buildIcsCalendar(makeAlignment(), null, 0).content;
    expect(withoutReminder).not.toContain('VALARM');
  });

  it('uses the local date string for the DTSTART when a timezone is set', () => {
    const { content } = buildIcsCalendar(makeAlignment({ timeZone: 'Asia/Singapore' }), null, 0);
    expect(content).toContain('DTSTART:20270731T230000Z');
  });

  it('escapes text and sanitizes the file name', () => {
    const { fileName, content } = buildIcsCalendar(
      makeAlignment({
        name: 'Moon/Set: 1 · 2',
        object: 'Moon',
        event: 'set',
        timeZone: null,
        observerSnapshot: { latitude: 1.31, longitude: 103.88 }
      }),
      'Tower, A; B',
      0
    );

    expect(fileName).toBe('Moon-Set- 1 · 2.ics');
    expect(content).toContain('SUMMARY:Moonset — Tower\\, A\\; B');
  });
});
