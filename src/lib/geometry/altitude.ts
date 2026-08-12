import { greatCircleDistanceKm } from './distance';

const METERS_PER_KM = 1000;

export function targetAltitude(observer: { elevation: number }, target: { elevation: number }, distanceKm: number): number {
  if (distanceKm <= 0) {
    return 0;
  }

  const elevationDifference = target.elevation - observer.elevation;
  return Math.atan2(elevationDifference, distanceKm * METERS_PER_KM) * (180 / Math.PI);
}
