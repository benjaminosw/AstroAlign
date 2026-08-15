import { describe, expect, it } from 'vitest';
import { initialBearing } from '../../geometry/bearing';
import { angularDifference } from '../../geometry/angularSeparation';
import {
  pathPointAtFraction,
  pathTotalLengthKm,
  signedBearingDelta,
  solvePathPositions
} from '../pathGeometry';
import type { ShootingAreaPoint } from '../types';

function errorAtFraction(fraction: number): number {
  const length = pathTotalLengthKm(NORTH_PATH.start, NORTH_PATH.end);
  const bearing = 90;
  const point = pathPointAtFraction(NORTH_PATH.start, NORTH_PATH.end, length, bearing, fraction);
  return angularDifference(initialBearing(point.latitude, point.longitude, TARGET.latitude, TARGET.longitude), 180);
}

const TARGET = { latitude: 0, longitude: 0, elevation: 0 };

function point(latitude: number, longitude: number): ShootingAreaPoint {
  return { id: 'p', name: 'Point', latitude, longitude };
}

const NORTH_PATH = {
  start: point(0.05, -0.02),
  end: point(0.05, 0.02)
};

describe('signedBearingDelta', () => {
  it('computes signed shortest differences', () => {
    expect(signedBearingDelta(10, 20)).toBeCloseTo(10, 9);
    expect(signedBearingDelta(350, 10)).toBeCloseTo(20, 9);
    expect(signedBearingDelta(10, 350)).toBeCloseTo(-20, 9);
    expect(Math.abs(signedBearingDelta(0, 180))).toBeCloseTo(180, 9);
    expect(Math.abs(signedBearingDelta(180, 0))).toBeCloseTo(180, 9);
  });
});

describe('pathTotalLengthKm', () => {
  it('measures the great-circle length of the path', () => {
    const length = pathTotalLengthKm(NORTH_PATH.start, NORTH_PATH.end);
    expect(length).toBeGreaterThan(4);
    expect(length).toBeLessThan(5);
  });
});

describe('pathPointAtFraction', () => {
  it('returns the start at fraction 0 and the end at fraction 1', () => {
    const length = pathTotalLengthKm(NORTH_PATH.start, NORTH_PATH.end);
    const bearing = 90;
    const start = pathPointAtFraction(NORTH_PATH.start, NORTH_PATH.end, length, bearing, 0);
    const end = pathPointAtFraction(NORTH_PATH.start, NORTH_PATH.end, length, bearing, 1);
    expect(start.latitude).toBeCloseTo(NORTH_PATH.start.latitude, 9);
    expect(start.longitude).toBeCloseTo(NORTH_PATH.start.longitude, 9);
    expect(end.latitude).toBeCloseTo(NORTH_PATH.end.latitude, 5);
    expect(end.longitude).toBeCloseTo(NORTH_PATH.end.longitude, 5);
  });

  it('returns the midpoint at fraction 0.5', () => {
    const length = pathTotalLengthKm(NORTH_PATH.start, NORTH_PATH.end);
    const bearing = 90;
    const mid = pathPointAtFraction(NORTH_PATH.start, NORTH_PATH.end, length, bearing, 0.5);
    expect(mid.latitude).toBeCloseTo(0.05, 3);
    expect(mid.longitude).toBeCloseTo(0, 3);
  });
});

describe('solvePathPositions', () => {
  it('finds the best position where the bearing to the target matches the azimuth', () => {
    const result = solvePathPositions({
      start: NORTH_PATH.start,
      end: NORTH_PATH.end,
      target: TARGET,
      azimuth: 180,
      toleranceDegrees: 2
    });

    expect(result.best).not.toBeNull();
    expect(result.best!.bearingToTarget).toBeCloseTo(180, 0);
    expect(result.best!.alignmentError).toBeLessThanOrEqual(2);
    expect(result.zones.length).toBeGreaterThan(0);
    expect(result.best!.fraction).toBeGreaterThan(0.4);
    expect(result.best!.fraction).toBeLessThan(0.6);
  });

  it('returns valid zones only (every position inside is within tolerance)', () => {
    const result = solvePathPositions({
      start: NORTH_PATH.start,
      end: NORTH_PATH.end,
      target: TARGET,
      azimuth: 180,
      toleranceDegrees: 2
    });

    expect(result.zones.length).toBeGreaterThan(0);
    for (const zone of result.zones) {
      for (let index = 0; index <= 20; index++) {
        const fraction = zone.startFraction + ((zone.endFraction - zone.startFraction) * index) / 20;
        expect(errorAtFraction(fraction)).toBeLessThanOrEqual(2 + 1e-6);
      }
    }
  });

  it('returns no positions when the path never faces the target direction', () => {
    const targetNorth = { latitude: 0.06, longitude: 0, elevation: 0 };
    const result = solvePathPositions({
      start: NORTH_PATH.start,
      end: NORTH_PATH.end,
      target: targetNorth,
      azimuth: 180,
      toleranceDegrees: 2
    });

    expect(result.best).toBeNull();
    expect(result.zones).toHaveLength(0);
  });

  it('supports a zero tolerance by returning zero-width point zones', () => {
    const result = solvePathPositions({
      start: NORTH_PATH.start,
      end: NORTH_PATH.end,
      target: TARGET,
      azimuth: 180,
      toleranceDegrees: 0
    });

    expect(result.zones.length).toBeGreaterThan(0);
    expect(result.zones.some((zone) => Math.abs(zone.startFraction - zone.endFraction) < 1e-6)).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.alignmentError).toBeLessThan(0.5);
  });

  it('treats a zero-length path as a single point', () => {
    const single = point(0.05, 0);
    const result = solvePathPositions({
      start: single,
      end: single,
      target: TARGET,
      azimuth: 180,
      toleranceDegrees: 2
    });

    expect(result.zones).toHaveLength(1);
    expect(result.zones[0].startDistanceKm).toBeCloseTo(0, 9);
    expect(result.best).not.toBeNull();
    expect(result.best!.alignmentError).toBeLessThan(2);
  });

  it('handles a path that passes near the target without crashing', () => {
    const crossing = {
      start: point(0.005, -0.01),
      end: point(0.005, 0.01)
    };
    const result = solvePathPositions({
      start: crossing.start,
      end: crossing.end,
      target: TARGET,
      azimuth: 270,
      toleranceDegrees: 5
    });

    expect(Array.isArray(result.zones)).toBe(true);
  });
});
