import { toRadians, toDegrees } from './utils';

const EARTH_RADIUS_KM = 6371.0088;

export interface DestinationPoint {
  latitude: number;
  longitude: number;
}

export function destinationPoint(
  originLatitude: number,
  originLongitude: number,
  bearingDegrees: number,
  distanceKm: number
): DestinationPoint {
  if (!Number.isFinite(originLatitude) || originLatitude < -90 || originLatitude > 90) {
    throw new Error('Origin latitude must be between -90 and 90 degrees');
  }

  if (!Number.isFinite(originLongitude) || originLongitude < -180 || originLongitude > 180) {
    throw new Error('Origin longitude must be between -180 and 180 degrees');
  }

  if (!Number.isFinite(bearingDegrees)) {
    throw new Error('Bearing must be a valid number');
  }

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error('Distance must be a non-negative number');
  }

  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDegrees);
  const φ1 = toRadians(originLatitude);
  const λ1 = toRadians(originLongitude);

  const sinφ2 = Math.sin(φ1) * Math.cos(angularDistance) + Math.cos(φ1) * Math.sin(angularDistance) * Math.cos(bearing);
  const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)));

  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(φ1),
      Math.cos(angularDistance) - Math.sin(φ1) * sinφ2
    );

  return {
    latitude: toDegrees(φ2),
    longitude: ((toDegrees(λ2) + 540) % 360) - 180
  };
}
