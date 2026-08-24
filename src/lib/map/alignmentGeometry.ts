import { destinationPoint } from '../geometry/destinationPoint';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Length of the reverse-alignment observer ray drawn on the map, in kilometres. */
export const REVERSE_RAY_LENGTH_KM = 100;

export function directionLengthKm(targetDistanceKm: number): number {
  if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0) {
    return 1;
  }
  return Math.max(targetDistanceKm, 1);
}

export function directionEndpoint(
  origin: GeoPoint,
  bearingDegrees: number,
  lengthKm: number
): GeoPoint {
  return destinationPoint(origin.latitude, origin.longitude, bearingDegrees, lengthKm);
}

export function toleranceSector(
  origin: GeoPoint,
  targetBearingDegrees: number,
  toleranceDegrees: number,
  lengthKm: number,
  segments = 12
): Array<[number, number]> {
  if (!Number.isFinite(toleranceDegrees) || toleranceDegrees <= 0) {
    return [];
  }
  const points: Array<[number, number]> = [[origin.longitude, origin.latitude]];
  for (let index = 0; index <= segments; index++) {
    const angle = targetBearingDegrees - toleranceDegrees + (2 * toleranceDegrees * index) / segments;
    const point = destinationPoint(origin.latitude, origin.longitude, angle, lengthKm);
    points.push([point.longitude, point.latitude]);
  }
  points.push([origin.longitude, origin.latitude]);
  return points;
}
