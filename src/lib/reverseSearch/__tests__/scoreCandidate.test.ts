import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../scoreCandidate';
import { destinationPoint } from '../../geometry/destinationPoint';

const TARGET = { latitude: 1.315079159356616, longitude: 103.89212097301142, elevation: 0 };

describe('scoreCandidate', () => {
  it('reports zero alignment error when the camera-to-target bearing equals the rise azimuth', () => {
    const eventAzimuth = 100;
    const outbound = 280;
    const camera = destinationPoint(TARGET.latitude, TARGET.longitude, outbound, 2);

    const score = scoreCandidate(TARGET, { ...camera, elevation: 0 }, eventAzimuth, 0.5);

    expect(score.bearingToTarget).toBeCloseTo(eventAzimuth, 3);
    expect(score.alignmentError).toBeLessThan(0.001);
    expect(score.withinTolerance).toBe(true);
    expect(score.distanceKm).toBeCloseTo(2, 2);
  });

  it('reports an alignment error equal to the azimuth difference', () => {
    const outbound = 280.4;
    const camera = destinationPoint(TARGET.latitude, TARGET.longitude, outbound, 2);

    const score = scoreCandidate(TARGET, { ...camera, elevation: 0 }, 100, 2);

    expect(score.alignmentError).toBeCloseTo(0.4, 2);
    expect(score.withinTolerance).toBe(true);
  });

  it('marks the candidate outside tolerance when the error exceeds the tolerance', () => {
    const outbound = 280.6;
    const camera = destinationPoint(TARGET.latitude, TARGET.longitude, outbound, 2);

    const score = scoreCandidate(TARGET, { ...camera, elevation: 0 }, 100, 0.5);

    expect(score.alignmentError).toBeCloseTo(0.6, 2);
    expect(score.withinTolerance).toBe(false);
  });

  it('computes distance, bearing and target bearing from real geography', () => {
    const camera = { latitude: 0, longitude: 0, elevation: 0 };
    const score = scoreCandidate({ latitude: 1, longitude: 1, elevation: 0 }, camera, 100, 0.5);

    expect(score.distanceKm).toBeCloseTo(157.2, 0);
    expect(score.bearingToTarget).toBeGreaterThan(40);
    expect(score.bearingToTarget).toBeLessThan(50);
    expect(score.targetBearing).toBeCloseTo(score.bearingToTarget + 180 < 360 ? score.bearingToTarget + 180 : score.bearingToTarget - 180, 5);
    expect(score.targetAltitude).not.toBeNull();
  });

  it('handles the 0/360 boundary without producing an inflated error', () => {
    const camera = { latitude: 0.01, longitude: 0, elevation: 0 };
    const score = scoreCandidate({ latitude: 0, longitude: 0, elevation: 0 }, camera, 360, 0.5);

    expect(score.bearingToTarget).toBeCloseTo(180, 5);
    expect(score.alignmentError).toBeCloseTo(180, 5);
  });

  it('returns a null target altitude when elevations are not finite', () => {
    const camera = { latitude: 0, longitude: 0, elevation: Number.NaN };
    const score = scoreCandidate({ latitude: 0.01, longitude: 0, elevation: 0 }, camera, 180, 0.5);
    expect(score.targetAltitude).toBeNull();
  });
});
