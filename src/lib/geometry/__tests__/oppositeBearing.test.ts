import { describe, expect, it } from 'vitest';
import { oppositeBearing, initialBearing } from '../bearing';

describe('oppositeBearing', () => {
  it('returns the opposite cardinal directions', () => {
    expect(oppositeBearing(0)).toBeCloseTo(180, 9);
    expect(oppositeBearing(90)).toBeCloseTo(270, 9);
    expect(oppositeBearing(180)).toBeCloseTo(0, 9);
    expect(oppositeBearing(270)).toBeCloseTo(90, 9);
  });

  it('wraps across the 0/360 boundary', () => {
    expect(oppositeBearing(350)).toBeCloseTo(170, 9);
    expect(oppositeBearing(100)).toBeCloseTo(280, 9);
  });

  it('is an involution (applying twice returns the input)', () => {
    for (const bearing of [0, 45, 120, 200, 300, 359.5]) {
      expect(oppositeBearing(oppositeBearing(bearing))).toBeCloseTo(bearing, 9);
    }
  });

  it('produces camera-to-target = target-to-camera + 180 for known coordinates', () => {
    const camera = { latitude: 1.3, longitude: 103.87 };
    const target = { latitude: 1.315079159356616, longitude: 103.89212097301142 };

    const cameraToTarget = initialBearing(camera.latitude, camera.longitude, target.latitude, target.longitude);
    const targetToCamera = initialBearing(target.latitude, target.longitude, camera.latitude, camera.longitude);

    expect(oppositeBearing(targetToCamera)).toBeCloseTo(cameraToTarget, 2);
    expect(oppositeBearing(cameraToTarget)).toBeCloseTo(targetToCamera, 2);
  });
});
