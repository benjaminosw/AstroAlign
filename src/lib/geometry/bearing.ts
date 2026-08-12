import { toRadians, toDegrees } from './utils';

export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeAzimuth(toDegrees(Math.atan2(y, x)));
}

export function normalizeAzimuth(azimuth: number): number {
  return ((azimuth % 360) + 360) % 360;
}
