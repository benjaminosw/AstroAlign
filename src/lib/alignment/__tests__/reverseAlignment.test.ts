import { describe, expect, it } from 'vitest';
import { calculateReverseAlignment, reciprocalBearing } from '../reverseAlignment';
import { DEFAULT_TARGET } from '../../constants/defaultCoordinates';

describe('reciprocalBearing', () => {
  it('returns the 180° opposite bearing', () => {
    expect(reciprocalBearing(0)).toBe(180);
    expect(reciprocalBearing(90)).toBe(270);
    expect(reciprocalBearing(180)).toBe(0);
    expect(reciprocalBearing(270)).toBe(90);
  });

  it('handles fractional bearings', () => {
    expect(reciprocalBearing(123.42)).toBeCloseTo(303.42, 10);
    expect(reciprocalBearing(359.9)).toBeCloseTo(179.9, 10);
  });

  it('wraps values above 360 back into range', () => {
    // 450 ≡ 90, whose reciprocal is 270.
    expect(reciprocalBearing(450)).toBe(270);
    // 540 ≡ 180, whose reciprocal is 0.
    expect(reciprocalBearing(540)).toBe(0);
  });

  it('normalises negative bearings', () => {
    // -90 ≡ 270, whose reciprocal is 90.
    expect(reciprocalBearing(-90)).toBe(90);
    // -180 ≡ 180, whose reciprocal is 0.
    expect(reciprocalBearing(-180)).toBe(0);
  });

  it('always returns a value within [0, 360)', () => {
    for (let bearing = -720; bearing <= 720; bearing += 0.5) {
      const reciprocal = reciprocalBearing(bearing);
      expect(reciprocal).toBeGreaterThanOrEqual(0);
      expect(reciprocal).toBeLessThan(360);
    }
  });

  it('rejects non-finite input', () => {
    expect(() => reciprocalBearing(Number.NaN)).toThrow();
    expect(() => reciprocalBearing(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('calculateReverseAlignment', () => {
  const timeZone = 'Asia/Singapore';

  function expectConsistentResult(result: ReturnType<typeof calculateReverseAlignment>) {
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    // The required observer → target bearing equals the object azimuth.
    expect(result.shootingBearing).toBe(result.objectAzimuth);
    // The direction from the target towards possible observers is the reciprocal.
    expect(result.observerDirectionFromTarget).toBe(reciprocalBearing(result.objectAzimuth));
    expect(result.objectAzimuth).toBeGreaterThanOrEqual(0);
    expect(result.objectAzimuth).toBeLessThan(360);
    expect(result.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
    expect(new Date(result.utcInstant).toString()).not.toBe('Invalid Date');
  }

  it('calculates a sunrise reverse alignment at the target location', () => {
    const result = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'rise',
      date: '2025-09-20',
      timeZone,
      target: DEFAULT_TARGET
    });

    expectConsistentResult(result);
    expect(result?.date).toBe('2025-09-20');
    expect(result?.eventType).toBe('rise');
    expect(result?.object).toBe('Sun');
  });

  it('calculates a sunset reverse alignment at the target location', () => {
    const result = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'set',
      date: '2025-09-20',
      timeZone,
      target: DEFAULT_TARGET
    });

    expectConsistentResult(result);
    expect(result?.eventType).toBe('set');
  });

  it('calculates a moonrise reverse alignment at the target location', () => {
    const result = calculateReverseAlignment({
      object: 'Moon',
      eventType: 'rise',
      date: '2026-08-29',
      timeZone,
      target: DEFAULT_TARGET
    });

    expectConsistentResult(result);
    expect(result?.object).toBe('Moon');
  });

  it('calculates a moonset reverse alignment at the target location', () => {
    const result = calculateReverseAlignment({
      object: 'Moon',
      eventType: 'set',
      date: '2026-08-29',
      timeZone,
      target: DEFAULT_TARGET
    });

    expectConsistentResult(result);
  });

  it('returns null when no sunrise occurs on the selected date (polar night)', () => {
    const result = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'rise',
      date: '2025-12-21',
      timeZone: 'Europe/Oslo',
      target: { latitude: 69.6492, longitude: 18.9553, elevation: 0 }
    });

    expect(result).toBeNull();
  });

  it('returns null when no sunset occurs on the selected date (midnight sun)', () => {
    const result = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'set',
      date: '2025-06-21',
      timeZone: 'Europe/Oslo',
      target: { latitude: 69.6492, longitude: 18.9553, elevation: 0 }
    });

    expect(result).toBeNull();
  });

  it('reports event times in the requested timezone', () => {
    const singapore = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'rise',
      date: '2025-09-20',
      timeZone,
      target: DEFAULT_TARGET
    });

    const london = calculateReverseAlignment({
      object: 'Sun',
      eventType: 'rise',
      date: '2025-09-20',
      timeZone: 'Europe/London',
      target: { latitude: 51.5074, longitude: -0.1278, elevation: 0 }
    });

    expect(singapore?.timeZoneLabel).toContain('Asia/Singapore');
    expect(london?.timeZoneLabel).toContain('Europe/London');
  });
});
