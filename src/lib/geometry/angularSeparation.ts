import { toRadians, toDegrees } from './utils';

export interface SphericalDirection {
  azimuth: number;
  altitude: number;
}

export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function angularSeparation(direction1: SphericalDirection, direction2: SphericalDirection): number {
  if (direction1.azimuth === direction2.azimuth && direction1.altitude === direction2.altitude) {
    return 0;
  }

  const φ1 = toRadians(direction1.altitude);
  const φ2 = toRadians(direction2.altitude);
  const Δλ = toRadians(angularDifference(direction1.azimuth, direction2.azimuth));

  // Use spherical angle formula for the distance between two points on a unit sphere.
  const cosAngle = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return toDegrees(Math.acos(Math.min(1, Math.max(-1, cosAngle))));
}
