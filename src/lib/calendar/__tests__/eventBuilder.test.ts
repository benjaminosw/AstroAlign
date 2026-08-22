import { describe, expect, it } from 'vitest';
import { ASTRO_OBJECT } from '../../../types/astronomy';
import { buildCalendarEvent, buildDescription, formatCalendarTitle } from '../eventBuilder';
import { MOON_PHASE_BUCKETS, type MoonPhaseInfo } from '../../astronomy/lunarPhase';

const fullMoonPhase: MoonPhaseInfo = {
  name: 'Full Moon',
  emoji: '\u{1F315}',
  phaseAngle: 180,
  illuminationPercent: 99.8
};

const SINGAPORE = 'Asia/Singapore';

describe('formatCalendarTitle', () => {
  it('uses the moon phase for Moon alignments with phase data', () => {
    expect(
      formatCalendarTitle({
        object: ASTRO_OBJECT.Moon,
        event: 'rise',
        date: '2026-08-29',
        time: '19:42:18',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 0.12,
        moonPhase: fullMoonPhase,
        targetName: 'Lighthouse'
      })
    ).toBe('\u{1F315} Full Moon \u2014 Lighthouse Alignment');
  });

  it('falls back to the event label when no phase data exists', () => {
    expect(
      formatCalendarTitle({
        object: ASTRO_OBJECT.Moon,
        event: 'set',
        date: '2026-08-29',
        time: '06:00',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 0.3,
        targetName: 'Marina'
      })
    ).toBe('\u{1F319} Moonset \u2014 Marina Alignment');
  });

  it('labels Sun rise/set events', () => {
    const base = { object: ASTRO_OBJECT.Sun, date: '2026-08-29', timeZone: SINGAPORE, alignmentErrorDegrees: 0.18 };
    expect(formatCalendarTitle({ ...base, event: 'rise', time: '06:58:12', targetName: 'Lighthouse' })).toBe(
      '\u{1F305} Sunrise \u2014 Lighthouse Alignment'
    );
    expect(formatCalendarTitle({ ...base, event: 'set', time: '19:10', targetName: 'Pier' })).toBe(
      '\u{1F307} Sunset \u2014 Pier Alignment'
    );
    expect(formatCalendarTitle({ ...base, event: null, time: '12:00', targetName: 'Marina Bay Sands' })).toBe(
      '\u2600\uFE0F Sun \u2014 Marina Bay Sands Alignment'
    );
  });

  it('generates a sensible title without a target name and never exposes ids', () => {
    expect(
      formatCalendarTitle({
        object: ASTRO_OBJECT.Moon,
        event: null,
        date: '2026-08-29',
        time: '22:00',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 1,
        moonPhase: fullMoonPhase,
        targetName: null
      })
    ).toBe('\u{1F315} Full Moon Alignment \u2014 AstroAlign');
  });
});

describe('buildDescription', () => {
  it('includes moon data for Moon alignments and shooting position details', () => {
    const description = buildDescription({
      object: ASTRO_OBJECT.Moon,
      event: 'rise',
      date: '2026-08-29',
      time: '19:42:18',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.12,
      celestialAzimuth: 123.456,
      targetBearing: 123.4,
      moonPhase: fullMoonPhase,
      moonIlluminationPercent: 99.8,
      targetName: 'Lighthouse',
      observer: { latitude: 1.3127197, longitude: 103.8800259 },
      targetPoint: { latitude: 1.3150792, longitude: 103.892121 },
      shootingPosition: {
        latitude: 1.3127197,
        longitude: 103.8800259,
        bearingToTarget: 123.4,
        distanceFromStartKm: 0.182
      }
    });

    expect(description).toContain('ASTROALIGN ALIGNMENT');
    expect(description).toContain('Target:\nLighthouse');
    expect(description).toContain('Object:\nMoon');
    expect(description).toContain('Event:\nMoonrise');
    expect(description).toContain('Moon Phase:\nFull Moon (100% illuminated)');
    expect(description).toContain('Date:\n29 August 2026');
    expect(description).toContain('Time:\n19:42:18');
    expect(description).toContain('Alignment Error:\n0.12\u00B0');
    expect(description).toContain('Shooting Location:\n1.3127197, 103.8800259');
    expect(description).toContain('Distance from corridor start:\n182 m');
    expect(description).toContain('Target Coordinates:\n1.3150792, 103.8921210');
    expect(description).toContain('Bearing:\n123.40\u00B0');
    expect(description.endsWith('AstroAlign')).toBe(true);
  });

  it('omits moon phase and corridor details for Sun alignments', () => {
    const description = buildDescription({
      object: ASTRO_OBJECT.Sun,
      event: 'rise',
      date: '2026-08-29',
      time: '06:58:12',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.18,
      targetName: 'Lighthouse',
      observer: { latitude: 1.31, longitude: 103.88 }
    });

    expect(description).not.toContain('Moon Phase');
    expect(description).not.toContain('Distance from corridor start');
    expect(description).toContain('Object:\nSun');
    expect(description).toContain('Event:\nSunrise');
    // Falls back to the observer coordinates as the shooting location.
    expect(description).toContain('Shooting Location:\n1.3100000, 103.8800000');
  });

  it('only includes fields that exist (no observer, no target point)', () => {
    const description = buildDescription({
      object: ASTRO_OBJECT.Moon,
      event: null,
      date: '2026-01-01',
      time: '00:30',
      timeZone: 'Europe/Paris',
      alignmentErrorDegrees: 0.4
    });
    expect(description).not.toContain('Shooting Location');
    expect(description).not.toContain('Bearing');
    expect(description).not.toContain('Target:');
  });
});

describe('buildCalendarEvent', () => {
  it('preserves exact seconds and applies the configurable duration', () => {
    const draft = buildCalendarEvent({
      object: ASTRO_OBJECT.Moon,
      event: 'rise',
      date: '2026-08-29',
      time: '19:42:18',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.12,
      moonPhase: fullMoonPhase,
      targetName: 'Lighthouse',
      shootingPosition: { latitude: 1.3127197, longitude: 103.8800259, bearingToTarget: 123.4 }
    });

    // 19:42:18 Singapore = 11:42:18 UTC.
    expect(draft.startUtc.toISOString()).toBe('2026-08-29T11:42:18.000Z');
    expect(draft.endUtc.toISOString()).toBe('2026-08-29T11:47:18.000Z');
    expect(draft.timeZone).toBe(SINGAPORE);
    expect(draft.date).toBe('2026-08-29');
  });

  it('keeps the correct absolute instant across timezone boundaries near midnight', () => {
    const singaporeDraft = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: 'rise',
      date: '2026-01-01',
      time: '00:05',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.2,
      observer: { latitude: 1.3521, longitude: 103.8198 }
    });
    expect(singaporeDraft.startUtc.toISOString()).toBe('2025-12-31T16:05:00.000Z');

    const londonDraft = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: 'set',
      date: '2026-07-01',
      time: '21:21:33',
      timeZone: 'Europe/London',
      alignmentErrorDegrees: 0.2,
      observer: { latitude: 51.5074, longitude: -0.1278 }
    });
    // BST in July (+01:00).
    expect(londonDraft.startUtc.toISOString()).toBe('2026-07-01T20:21:33.000Z');
  });

  it('builds a safe filename including target, subject and date', () => {
    expect(
      buildCalendarEvent({
        object: ASTRO_OBJECT.Moon,
        event: 'rise',
        date: '2026-08-29',
        time: '19:42:18',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 0.12,
        moonPhase: fullMoonPhase,
        targetName: 'Lighthouse Point'
      }).filenameBase
    ).toBe('AstroAlign_Lighthouse_Point_Full_Moon_2026-08-29');

    expect(
      buildCalendarEvent({
        object: ASTRO_OBJECT.Sun,
        event: 'rise',
        date: '2026-08-29',
        time: '06:58:12',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 0.18,
        targetName: '\u706F\u5854/\u5CF6?'
      }).filenameBase
    ).toBe('AstroAlign_Sunrise_2026-08-29');
  });

  it('covers every moon phase bucket without throwing', () => {
    for (const bucket of MOON_PHASE_BUCKETS) {
      const title = formatCalendarTitle({
        object: ASTRO_OBJECT.Moon,
        event: 'rise',
        date: '2026-08-29',
        time: '20:00',
        timeZone: SINGAPORE,
        alignmentErrorDegrees: 0.1,
        moonPhase: { ...bucket, phaseAngle: 0, illuminationPercent: 50 },
        targetName: 'Tower'
      });
      expect(title).toContain(bucket.name);
    }
  });
});
