import { describe, expect, it } from 'vitest';
import { initialBearing } from '../../geometry/bearing';
import { directionEndpoint, directionLengthKm, toleranceSector } from '../alignmentGeometry';

describe('directionLengthKm', () => {
  it('returns a positive minimum length for zero or invalid distances', () => {
    expect(directionLengthKm(0)).toBe(1);
    expect(directionLengthKm(-5)).toBe(1);
    expect(directionLengthKm(Number.NaN)).toBe(1);
  });

  it('returns the target distance when it is at least the minimum', () => {
    expect(directionLengthKm(1.5)).toBe(1.5);
    expect(directionLengthKm(120)).toBe(120);
  });
});

describe('directionEndpoint', () => {
  it('projects a point from the origin along the given bearing', () => {
    const endpoint = directionEndpoint({ latitude: 0, longitude: 0 }, 90, 111.19);
    expect(endpoint.latitude).toBeCloseTo(0, 5);
    expect(endpoint.longitude).toBeCloseTo(1, 4);
  });

  it('projects north as an increase in latitude', () => {
    const endpoint = directionEndpoint({ latitude: 1, longitude: 100 }, 0, 111.19);
    expect(endpoint.latitude).toBeCloseTo(2, 4);
    expect(endpoint.longitude).toBeCloseTo(100, 4);
  });
});

describe('toleranceSector', () => {
  it('returns an empty polygon when tolerance is not positive', () => {
    expect(toleranceSector({ latitude: 1, longitude: 2 }, 90, 0, 10)).toEqual([]);
    expect(toleranceSector({ latitude: 1, longitude: 2 }, 90, -1, 10)).toEqual([]);
  });

  it('builds a closed fan that starts and ends at the origin', () => {
    const sector = toleranceSector({ latitude: 0, longitude: 0 }, 0, 30, 111.19, 4);
    expect(sector).toHaveLength(7);
    expect(sector[0]).toEqual([0, 0]);
    expect(sector[sector.length - 1]).toEqual([0, 0]);
  });

  it('spans the target bearing minus and plus the tolerance', () => {
    const sector = toleranceSector({ latitude: 0, longitude: 0 }, 0, 30, 111.19, 4);
    const bearings = sector.slice(1, -1).map(([longitude, latitude]) => initialBearing(0, 0, latitude, longitude));
    expect(bearings[0]).toBeCloseTo(330, 3);
    expect(bearings[1]).toBeCloseTo(345, 3);
    expect(bearings[2]).toBeCloseTo(0, 3);
    expect(bearings[3]).toBeCloseTo(15, 3);
    expect(bearings[4]).toBeCloseTo(30, 3);
  });
});
