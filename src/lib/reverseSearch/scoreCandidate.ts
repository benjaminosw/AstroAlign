import type { GeographicPoint } from '../../types/astronomy';
import { angularDifference } from '../geometry/angularSeparation';
import { greatCircleDistanceKm } from '../geometry/distance';
import { initialBearing, oppositeBearing } from '../geometry/bearing';
import { targetAltitude } from '../geometry/altitude';

export interface CandidateScore {
  distanceKm: number;
  bearingToTarget: number;
  targetBearing: number;
  alignmentError: number;
  withinTolerance: boolean;
  targetAltitude: number | null;
}

export function scoreCandidate(
  target: GeographicPoint,
  camera: Pick<GeographicPoint, 'latitude' | 'longitude' | 'elevation'>,
  eventAzimuth: number,
  toleranceDegrees: number
): CandidateScore {
  const bearingToTarget = initialBearing(camera.latitude, camera.longitude, target.latitude, target.longitude);
  const distanceKm = greatCircleDistanceKm(camera.latitude, camera.longitude, target.latitude, target.longitude);
  const alignmentError = angularDifference(bearingToTarget, eventAzimuth);

  let targetAltitudeValue: number | null = null;
  if (Number.isFinite(camera.elevation) && Number.isFinite(target.elevation)) {
    targetAltitudeValue = targetAltitude(camera, target, distanceKm);
  }

  return {
    distanceKm,
    bearingToTarget,
    targetBearing: oppositeBearing(bearingToTarget),
    alignmentError,
    withinTolerance: alignmentError <= toleranceDegrees,
    targetAltitude: targetAltitudeValue
  };
}
