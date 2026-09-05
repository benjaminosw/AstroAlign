import { destinationPoint } from './destinationPoint';
import { toRadians } from './utils';

const EARTH_RADIUS_KM = 6371.0088;

export interface RayProjectionPoint {
  latitude: number;
  longitude: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Signed distance, in kilometres, from the ray origin to the projection of
 * `point` onto the ray (origin + constant bearing).
 *
 * Uses a local equirectangular approximation, which stays accurate to well
 * under a percent across the ~100 km the reverse-alignment ray covers. Points
 * behind the origin project to a negative distance.
 */
export function alongRayDistanceKm(origin: RayProjectionPoint, bearingDegrees: number, point: RayProjectionPoint): number {
  const eastKm = toRadians(point.longitude - origin.longitude) * EARTH_RADIUS_KM * Math.cos(toRadians(origin.latitude));
  const northKm = toRadians(point.latitude - origin.latitude) * EARTH_RADIUS_KM;
  const course = toRadians(bearingDegrees);
  return eastKm * Math.sin(course) + northKm * Math.cos(course);
}

/** Projects `point` onto the ray and clamps the resulting distance to `[minDistanceKm, maxDistanceKm]`. */
export function projectPointOntoRay(
  origin: RayProjectionPoint,
  bearingDegrees: number,
  point: RayProjectionPoint,
  minDistanceKm = 0,
  maxDistanceKm = Number.POSITIVE_INFINITY
): { point: RayProjectionPoint; distanceKm: number } {
  const distanceKm = clamp(alongRayDistanceKm(origin, bearingDegrees, point), minDistanceKm, maxDistanceKm);
  return {
    point: destinationPoint(origin.latitude, origin.longitude, bearingDegrees, distanceKm),
    distanceKm
  };
}