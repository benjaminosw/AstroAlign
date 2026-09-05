import { describe, expect, it } from 'vitest';
import { alongRayDistanceKm, projectPointOntoRay } from '../rayProjection';
import { destinationPoint } from '../destinationPoint';
import { initialBearing } from '../bearing';

const ORIGIN = { latitude: 1.3521, longitude: 103.8198 };
const BEARING = 303.42;

describe('alongRayDistanceKm', () => {
  it('returns the distance for a point exactly on the ray', () => {
    const onRay = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING, 25);
    // The equirectangular approximation is accurate to well under a metre here.
    expect(alongRayDistanceKm(ORIGIN, BEARING, onRay)).toBeCloseTo(25, 2);
  });

  it('returns ~0 for the origin itself', () => {
    expect(alongRayDistanceKm(ORIGIN, BEARING, ORIGIN)).toBeCloseTo(0, 6);
  });

  it('returns a negative distance for a point behind the origin', () => {
    const behind = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, (BEARING + 180) % 360, 10);
    expect(alongRayDistanceKm(ORIGIN, BEARING, behind)).toBeLessThan(-5);
  });

  it('projects an off-axis point to a shorter along-ray distance', () => {
    const offset = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING + 20, 20);
    const along = alongRayDistanceKm(ORIGIN, BEARING, offset);
    expect(along).toBeGreaterThan(0);
    expect(along).toBeLessThan(20);
  });

  it('handles all four bearing orientations', () => {
    for (const bearing of [0, 90, 180, 270]) {
      const onRay = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, bearing, 12);
      expect(alongRayDistanceKm(ORIGIN, bearing, onRay)).toBeCloseTo(12, 4);
    }
  });
});

describe('projectPointOntoRay', () => {
  it('keeps a point already on the ray in place', () => {
    const onRay = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING, 25);
    const projection = projectPointOntoRay(ORIGIN, BEARING, onRay);
    expect(projection.distanceKm).toBeCloseTo(25, 2);
    expect(projection.point.latitude).toBeCloseTo(onRay.latitude, 5);
    expect(projection.point.longitude).toBeCloseTo(onRay.longitude, 5);
  });

  it('projects an off-axis point onto the ray', () => {
    const offset = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING + 35, 30);
    const projection = projectPointOntoRay(ORIGIN, BEARING, offset);
    const projectedBearing = initialBearing(
      ORIGIN.latitude,
      ORIGIN.longitude,
      projection.point.latitude,
      projection.point.longitude
    );
    expect(projectedBearing).toBeCloseTo(BEARING, 1);
    expect(projection.distanceKm).toBeGreaterThan(0);
    expect(projection.distanceKm).toBeLessThan(30);
  });

  it('clamps negative (behind) projections to the minimum distance', () => {
    const behind = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, (BEARING + 180) % 360, 10);
    const projection = projectPointOntoRay(ORIGIN, BEARING, behind, 0.1, 100);
    expect(projection.distanceKm).toBeCloseTo(0.1, 6);
  });

  it('clamps distances beyond the maximum', () => {
    const far = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING, 250);
    const projection = projectPointOntoRay(ORIGIN, BEARING, far, 0, 100);
    expect(projection.distanceKm).toBeCloseTo(100, 6);
    const maxPoint = destinationPoint(ORIGIN.latitude, ORIGIN.longitude, BEARING, 100);
    expect(projection.point.latitude).toBeCloseTo(maxPoint.latitude, 6);
    expect(projection.point.longitude).toBeCloseTo(maxPoint.longitude, 6);
  });

  it('clamps the origin itself to the minimum distance when supplied', () => {
    const projection = projectPointOntoRay(ORIGIN, BEARING, ORIGIN, 0.1, 100);
    expect(projection.distanceKm).toBeCloseTo(0.1, 6);
  });
});