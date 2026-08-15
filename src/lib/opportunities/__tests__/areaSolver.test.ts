import { describe, expect, it } from 'vitest';
import { solveAreaShootingPositions } from '../areaSolver';
import type { ShootingAreaPoint } from '../types';

const TARGET = { latitude: 0, longitude: 0, elevation: 0 };

function point(id: string, name: string, latitude: number, longitude: number): ShootingAreaPoint {
  return { id, name, latitude, longitude };
}

describe('solveAreaShootingPositions', () => {
  it('keeps only points whose bearing to the target matches the azimuth', () => {
    const area = {
      type: 'points' as const,
      points: [
        point('n', 'North', 0.05, 0),
        point('e', 'East', 0, 0.05),
        point('s', 'South', -0.05, 0)
      ]
    };

    const result = solveAreaShootingPositions({ area, target: TARGET, azimuth: 180, toleranceDegrees: 5 });

    expect(result.mode).toBe('points');
    expect(result.pathZones).toHaveLength(0);
    expect(result.solutions.map((solution) => solution.pointId)).toEqual(['n']);
    expect(result.solutions[0].source).toBe('point');
    expect(result.solutions[0].alignmentError).toBeLessThan(1e-6);
  });

  it('returns points sorted by alignment error', () => {
    const area = {
      type: 'points' as const,
      points: [
        point('a', 'A', 0.05, 0.05),
        point('b', 'B', 0.05, 0.01),
        point('c', 'C', 0.05, 0)
      ]
    };

    const result = solveAreaShootingPositions({ area, target: TARGET, azimuth: 180, toleranceDegrees: 15 });

    const errors = result.solutions.map((solution) => solution.alignmentError);
    expect(errors.length).toBeGreaterThan(1);
    expect([...errors].sort((a, b) => a - b)).toEqual(errors);
  });

  it('returns the best position and path zones for a path area', () => {
    const area = {
      type: 'path' as const,
      start: point('s', 'Start', 0.05, -0.02),
      end: point('e', 'End', 0.05, 0.02)
    };

    const result = solveAreaShootingPositions({ area, target: TARGET, azimuth: 180, toleranceDegrees: 2 });

    expect(result.mode).toBe('path');
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0].source).toBe('path');
    expect(result.solutions[0].alignmentError).toBeLessThanOrEqual(2);
    expect(result.pathZones.length).toBeGreaterThan(0);
  });
});
