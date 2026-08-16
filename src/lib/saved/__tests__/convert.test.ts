import { describe, expect, it } from 'vitest';
import type { ShootingArea } from '../../opportunities/types';
import {
  coordinateKey,
  generatedLocationName,
  generatedTargetName,
  geometryKey,
  geometrySummary,
  geometryToShootingArea,
  sameCoordinates,
  savedPointCount,
  shootingAreaToGeometry,
  targetToLandmark
} from '../types';

const pathArea: ShootingArea = {
  type: 'path',
  start: { id: 'start', name: 'Start', latitude: 1.31, longitude: 103.88 },
  end: { id: 'end', name: 'End', latitude: 1.33, longitude: 103.9 }
};

const pointsArea: ShootingArea = {
  type: 'points',
  points: [
    { id: 'p1', name: 'Point 1', latitude: 1.31, longitude: 103.88 },
    { id: 'p2', name: 'Point 2', latitude: 1.33, longitude: 103.9 }
  ]
};

describe('shootingAreaToGeometry', () => {
  it('converts a path area to a path geometry', () => {
    const geometry = shootingAreaToGeometry(pathArea);
    expect(geometry.type).toBe('path');
    if (geometry.type === 'path') {
      expect(geometry.start).toEqual(pathArea.start);
      expect(geometry.end).toEqual(pathArea.end);
    }
  });

  it('converts a multi-point area to a points geometry', () => {
    const geometry = shootingAreaToGeometry(pointsArea);
    expect(geometry.type).toBe('points');
    if (geometry.type === 'points') {
      expect(geometry.points).toEqual(pointsArea.points);
    }
  });

  it('converts a single-point area to a point geometry', () => {
    const geometry = shootingAreaToGeometry({ type: 'points', points: [pointsArea.points[0]] });
    expect(geometry.type).toBe('point');
  });
});

describe('geometryToShootingArea', () => {
  it('round-trips a path area', () => {
    expect(geometryToShootingArea(shootingAreaToGeometry(pathArea))).toEqual(pathArea);
  });

  it('round-trips a points area', () => {
    expect(geometryToShootingArea(shootingAreaToGeometry(pointsArea))).toEqual(pointsArea);
  });

  it('converts a point geometry back to a single-point points area', () => {
    const geometry = { type: 'point' as const, point: pointsArea.points[0] };
    expect(geometryToShootingArea(geometry)).toEqual({ type: 'points', points: [pointsArea.points[0]] });
  });
});

describe('geometryKey', () => {
  it('produces identical keys for identical geometries', () => {
    expect(geometryKey(shootingAreaToGeometry(pathArea))).toBe(geometryKey(shootingAreaToGeometry(pathArea)));
  });

  it('produces different keys for different geometries', () => {
    expect(geometryKey(shootingAreaToGeometry(pathArea))).not.toBe(geometryKey(shootingAreaToGeometry(pointsArea)));
  });

  it('is order-insensitive for points geometries', () => {
    const geometry = shootingAreaToGeometry(pointsArea);
    if (geometry.type !== 'points') {
      throw new Error('Expected a points geometry');
    }
    const reversed = { ...geometry, points: [...geometry.points].reverse() };
    expect(geometryKey(reversed)).toBe(geometryKey(geometry));
  });

  it('matches point geometries at 6-decimal precision', () => {
    const first = { type: 'point' as const, point: { id: 'a', name: '', latitude: 1.1234567, longitude: 103.1234567 } };
    const second = { type: 'point' as const, point: { id: 'b', name: '', latitude: 1.1234569, longitude: 103.1234569 } };
    expect(geometryKey(first)).toBe(geometryKey(second));
  });
});

describe('coordinate helpers', () => {
  it('sameCoordinates compares at 6-decimal precision', () => {
    expect(sameCoordinates({ latitude: 1.1234567, longitude: 2.1234567 }, { latitude: 1.1234569, longitude: 2.1234569 })).toBe(
      true
    );
    expect(sameCoordinates({ latitude: 1.123, longitude: 2.123 }, { latitude: 1.124, longitude: 2.123 })).toBe(false);
  });

  it('coordinateKey formats coordinates', () => {
    expect(coordinateKey(1.1234567, 2.1234567)).toBe('1.123457,2.123457');
  });
});

describe('generated names', () => {
  it('generates a target name from coordinates', () => {
    expect(generatedTargetName({ latitude: 1.31, longitude: 103.88 })).toBe('Target 1.310000,103.880000');
  });

  it('generates a location name for each geometry type', () => {
    expect(generatedLocationName({ type: 'point', point: { id: 'a', name: '', latitude: 1, longitude: 2 } })).toContain(
      'Single point'
    );
    expect(generatedLocationName({ type: 'path', start: { id: 's', name: 'S', latitude: 1, longitude: 2 }, end: { id: 'e', name: 'E', latitude: 3, longitude: 4 } })).toBe(
      'Path · S → E'
    );
    expect(
      generatedLocationName({ type: 'points', points: [{ id: 'a', name: '', latitude: 1, longitude: 2 }, { id: 'b', name: '', latitude: 3, longitude: 4 }] })
    ).toBe('2 points');
  });
});

describe('misc helpers', () => {
  it('savedPointCount returns the number of points', () => {
    expect(savedPointCount({ type: 'point', point: { id: 'a', name: '', latitude: 1, longitude: 2 } })).toBe(1);
    expect(savedPointCount(shootingAreaToGeometry(pathArea))).toBe(2);
    expect(savedPointCount(shootingAreaToGeometry(pointsArea))).toBe(2);
  });

  it('geometrySummary describes the geometry', () => {
    expect(geometrySummary(shootingAreaToGeometry(pathArea))).toContain('→');
    expect(geometrySummary({ type: 'points', points: [{ id: 'a', name: '', latitude: 1, longitude: 2 }, { id: 'b', name: '', latitude: 3, longitude: 4 }] })).toBe('2 points');
  });

  it('targetToLandmark builds a SelectedLandmark from a saved target', () => {
    const target = {
      id: 'target-1',
      name: 'Tower',
      latitude: 1.31,
      longitude: 103.88,
      elevation: 12,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const landmark = targetToLandmark(target);
    expect(landmark.name).toBe('Tower');
    expect(landmark.latitude).toBe(1.31);
    expect(landmark.longitude).toBe(103.88);
    expect(landmark.id).toContain(target.id);
  });
});
