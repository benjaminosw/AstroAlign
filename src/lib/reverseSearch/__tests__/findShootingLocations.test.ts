import { describe, expect, it } from 'vitest';
import { findShootingLocations } from '../findShootingLocations';
import { ASTRO_OBJECT } from '../../../types/astronomy';

const SINGAPORE = {
  latitude: 1.315079159356616,
  longitude: 103.89212097301142,
  elevation: 0
};

const BASE_INPUT = {
  target: SINGAPORE,
  date: '2027-08-17',
  timeZone: 'Asia/Singapore',
  toleranceDegrees: 5,
  searchRadiusKm: 10,
  fullMoonOnly: false
};

describe('findShootingLocations', () => {
  it('finds shooting locations for a sunrise event on the selected date', async () => {
    const result = await findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise' });

    expect(result.event.type).toBe('rise');
    expect(result.event.localDate).toBe('2027-08-17');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) => candidate.withinTolerance)).toBe(true);
  });

  it('finds shooting locations for a sunset event on the selected date', async () => {
    const result = await findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'set' });

    expect(result.event.type).toBe('set');
    expect(result.event.localDate).toBe('2027-08-17');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('finds shooting locations for a moonrise event on the selected date', async () => {
    const result = await findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Moon, eventType: 'rise' });

    expect(result.event.type).toBe('rise');
    expect(result.event.localDate).toBe('2027-08-17');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('finds shooting locations for a moonset event on the selected date', async () => {
    const result = await findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Moon, eventType: 'set' });

    expect(result.event.type).toBe('set');
    expect(result.event.localDate).toBe('2027-08-17');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('returns no candidates and explains when there is no valid rise/set event', async () => {
    const svalbard = { latitude: 78.22, longitude: 15.63, elevation: 0 };
    await expect(
      findShootingLocations({
        target: svalbard,
        date: '2027-06-21',
        timeZone: 'Arctic/Longyearbyen',
        object: ASTRO_OBJECT.Sun,
        eventType: 'rise',
        toleranceDegrees: 5,
        searchRadiusKm: 10
      })
    ).rejects.toThrow(/no valid rise event/i);
  });

  it('rejects candidates whose real alignment error exceeds the tolerance', async () => {
    const tight = await findShootingLocations({
      ...BASE_INPUT,
      object: ASTRO_OBJECT.Sun,
      eventType: 'rise',
      toleranceDegrees: 0.1
    });
    const wide = await findShootingLocations({
      ...BASE_INPUT,
      object: ASTRO_OBJECT.Sun,
      eventType: 'rise',
      toleranceDegrees: 5
    });

    expect(tight.candidates.every((candidate) => candidate.alignmentError <= 0.1 + 1e-6)).toBe(true);
    expect(wide.candidates.every((candidate) => candidate.alignmentError <= 5 + 1e-6)).toBe(true);
    expect(wide.candidates.length).toBeGreaterThanOrEqual(tight.candidates.length);
  });

  it('returns no candidate beyond the configured search radius', async () => {
    const result = await findShootingLocations({
      ...BASE_INPUT,
      object: ASTRO_OBJECT.Sun,
      eventType: 'rise',
      toleranceDegrees: 5,
      searchRadiusKm: 1
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) => candidate.distanceKm <= 1 + 1e-6)).toBe(true);
  });

  it('ranks candidates by alignment error first, then distance', async () => {
    const result = await findShootingLocations({
      ...BASE_INPUT,
      object: ASTRO_OBJECT.Sun,
      eventType: 'rise',
      toleranceDegrees: 5,
      searchRadiusKm: 20
    });

    for (let i = 1; i < result.candidates.length; i++) {
      const previous = result.candidates[i - 1];
      const current = result.candidates[i];
      expect(current.alignmentError).toBeGreaterThanOrEqual(previous.alignmentError - 1e-9);
      if (current.alignmentError === previous.alignmentError) {
        expect(current.distanceKm).toBeGreaterThanOrEqual(previous.distanceKm - 1e-9);
      }
    }
  });

  it('computes the ideal outbound bearing as the opposite of the event azimuth', async () => {
    const result = await findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise' });

    const expected = (result.event.azimuth + 180) % 360;
    expect(result.idealOutboundBearing).toBeCloseTo(expected, 9);
    expect(result.idealTargetBearing).toBeCloseTo(result.event.azimuth, 9);
  });

  it('keeps the full Moon ±1 day filter and rejects events outside the window', async () => {
    const withinWindow = await findShootingLocations({
      ...BASE_INPUT,
      object: ASTRO_OBJECT.Moon,
      eventType: 'rise',
      fullMoonOnly: true
    });

    expect(withinWindow.event.withinFullMoonWindow).toBe(true);
    expect(withinWindow.candidates.length).toBeGreaterThan(0);

    await expect(
      findShootingLocations({
        ...BASE_INPUT,
        target: SINGAPORE,
        date: '2027-08-21',
        object: ASTRO_OBJECT.Moon,
        eventType: 'rise',
        fullMoonOnly: true
      })
    ).rejects.toThrow(/24 hours from a full moon/i);
  });

  it('throws for an invalid date, tolerance, radius or timezone', async () => {
    await expect(findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise', date: 'not-a-date' })).rejects.toThrow(/date/i);
    await expect(findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise', toleranceDegrees: -1 })).rejects.toThrow(/tolerance/i);
    await expect(findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise', searchRadiusKm: 0 })).rejects.toThrow(/radius/i);
    await expect(findShootingLocations({ ...BASE_INPUT, object: ASTRO_OBJECT.Sun, eventType: 'rise', timeZone: '' })).rejects.toThrow(/timezone/i);
  });
});
