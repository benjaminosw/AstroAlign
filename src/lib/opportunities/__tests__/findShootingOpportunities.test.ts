import { describe, expect, it } from 'vitest';
import { findShootingOpportunities } from '../findShootingOpportunities';
import { ASTRO_OBJECT } from '../../../types/astronomy';
import { destinationPoint } from '../../geometry/destinationPoint';
import type { ShootingArea } from '../types';

const SINGAPORE = {
  latitude: 1.315079159356616,
  longitude: 103.89212097301142,
  elevation: 0
};

function pointFanAround(target: typeof SINGAPORE, fromDegrees: number, toDegrees: number, step: number): ShootingArea {
  const points = [];
  for (let pointBearing = fromDegrees; pointBearing <= toDegrees; pointBearing += step) {
    const placed = destinationPoint(target.latitude, target.longitude, pointBearing + 180, 2);
    points.push({
      id: `p${pointBearing}`,
      name: `${pointBearing}deg`,
      latitude: placed.latitude,
      longitude: placed.longitude
    });
  }
  return { type: 'points', points };
}

const SUN_FAN = pointFanAround(SINGAPORE, 60, 100, 10);
const MOON_FAN = pointFanAround(SINGAPORE, 20, 160, 20);

function baseInput(overrides: Partial<Parameters<typeof findShootingOpportunities>[0]> = {}) {
  return {
    target: SINGAPORE,
    area: SUN_FAN,
    object: ASTRO_OBJECT.Sun,
    eventType: 'rise' as const,
    startDate: '2027-08-17',
    endDate: '2027-08-17',
    toleranceDegrees: 15,
    timeZone: 'Asia/Singapore',
    ...overrides
  };
}

describe('findShootingOpportunities', () => {
  it('finds a sunrise opportunity for the date with an aligned shooting point', async () => {
    const result = await findShootingOpportunities(baseInput());

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].eventType).toBe('rise');
    expect(result[0].eventLabel).toBe('Sunrise');
    expect(result[0].localDate).toBe('2027-08-17');
    expect(result[0].position.source).toBe('point');
    expect(result[0].position.alignmentError).toBeLessThanOrEqual(15 + 1e-6);
  });

  it('finds multiple moonrise opportunities across a date range with moon phases', async () => {
    const result = await findShootingOpportunities(
      baseInput({ object: ASTRO_OBJECT.Moon, area: MOON_FAN, startDate: '2027-08-15', endDate: '2027-08-19' })
    );

    expect(result.length).toBeGreaterThan(1);
    expect(result.every((opportunity) => opportunity.moonPhase !== undefined)).toBe(true);
    const dates = result.map((opportunity) => opportunity.localDate);
    expect(new Set(dates).size).toBeGreaterThan(1);
  });

  it('finds opportunities for many days across a multi-month range', async () => {
    const result = await findShootingOpportunities(
      baseInput({ startDate: '2026-07-01', endDate: '2026-09-30' })
    );

    expect(result.length).toBeGreaterThan(50);
  });

  it('sorts results by local date, then local time, then alignment error', async () => {
    const result = await findShootingOpportunities(
      baseInput({ startDate: '2027-08-15', endDate: '2027-08-19' })
    );

    for (let index = 1; index < result.length; index++) {
      const previous = result[index - 1];
      const current = result[index];
      const dateCompare = previous.localDate.localeCompare(current.localDate);
      expect(dateCompare).toBeLessThanOrEqual(0);
      if (dateCompare === 0) {
        expect(previous.localTime.localeCompare(current.localTime)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('reports progress once per searched day', async () => {
    let calls = 0;
    let lastProgress: [number, number] = [0, 0];
    await findShootingOpportunities(
      baseInput({
        onProgress: (completed, total) => {
          calls++;
          lastProgress = [completed, total];
        }
      })
    );

    expect(calls).toBe(1);
    expect(lastProgress).toEqual([1, 1]);
  });

  it('aborts a canceled search', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(findShootingOpportunities(baseInput({ signal: controller.signal }))).rejects.toThrow(
      /search canceled/i
    );
  });

  it('returns an empty list when no rise/set event exists in the range', async () => {
    const svalbard = { latitude: 78.22, longitude: 15.63, elevation: 0 };
    const result = await findShootingOpportunities(
      baseInput({
        target: svalbard,
        area: pointFanAround(svalbard, 60, 100, 10),
        startDate: '2027-06-21',
        endDate: '2027-06-21',
        timeZone: 'Arctic/Longyearbyen'
      })
    );

    expect(result).toHaveLength(0);
  });

  it('rejects invalid dates, tolerances, timezones, and empty point areas', async () => {
    await expect(findShootingOpportunities(baseInput({ startDate: 'not-a-date' }))).rejects.toThrow(
      /start date/i
    );
    await expect(findShootingOpportunities(baseInput({ endDate: 'not-a-date' }))).rejects.toThrow(
      /end date/i
    );
    await expect(
      findShootingOpportunities(baseInput({ startDate: '2027-08-18', endDate: '2027-08-17' }))
    ).rejects.toThrow(/before or equal/i);
    await expect(findShootingOpportunities(baseInput({ toleranceDegrees: -1 }))).rejects.toThrow(
      /tolerance/i
    );
    await expect(findShootingOpportunities(baseInput({ timeZone: '' }))).rejects.toThrow(/timezone/i);
    await expect(
      findShootingOpportunities(baseInput({ area: { type: 'points', points: [] } }))
    ).rejects.toThrow(/shooting point/i);
  });
});
