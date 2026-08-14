import { describe, expect, it } from 'vitest';
import { destinationPoint } from '../destinationPoint';
import { greatCircleDistanceKm } from '../distance';

describe('destinationPoint', () => {
  it('returns the origin unchanged for zero distance', () => {
    const result = destinationPoint(10, 20, 90, 0);
    expect(result.latitude).toBeCloseTo(10, 9);
    expect(result.longitude).toBeCloseTo(20, 9);
  });

  it('moves due north one degree from the equator', () => {
    const result = destinationPoint(0, 0, 0, 111.195);
    expect(result.latitude).toBeCloseTo(1, 4);
    expect(result.longitude).toBeCloseTo(0, 4);
  });

  it('moves due east one degree from the equator', () => {
    const result = destinationPoint(0, 0, 90, 111.195);
    expect(result.latitude).toBeCloseTo(0, 4);
    expect(result.longitude).toBeCloseTo(1, 4);
  });

  it('moves due south one degree from the equator', () => {
    const result = destinationPoint(0, 0, 180, 111.195);
    expect(result.latitude).toBeCloseTo(-1, 4);
  });

  it('moves due west one degree from the equator', () => {
    const result = destinationPoint(0, 0, 270, 111.195);
    expect(result.longitude).toBeCloseTo(-1, 4);
  });

  it('moves along a diagonal bearing across one degree of arc', () => {
    const result = destinationPoint(0, 0, 45, 111.195);
    expect(result.latitude).toBeCloseTo(0.7071, 3);
    expect(result.longitude).toBeCloseTo(0.7071, 3);
  });

  it('wraps longitude across the 180/-180 antimeridian', () => {
    const result = destinationPoint(0, 179.9, 90, 111.195);
    expect(result.longitude).toBeCloseTo(-179.1, 3);
  });

  it('matches round-trip distance with greatCircleDistanceKm', () => {
    const start = { latitude: 1.315079159356616, longitude: 103.89212097301142 };
    const moved = destinationPoint(start.latitude, start.longitude, 280, 5);
    const back = greatCircleDistanceKm(start.latitude, start.longitude, moved.latitude, moved.longitude);
    expect(back).toBeCloseTo(5, 3);
  });

  it('rejects invalid inputs', () => {
    expect(() => destinationPoint(91, 0, 0, 1)).toThrow(/latitude/i);
    expect(() => destinationPoint(0, 181, 0, 1)).toThrow(/longitude/i);
    expect(() => destinationPoint(0, 0, 0, -1)).toThrow(/distance/i);
  });
});
