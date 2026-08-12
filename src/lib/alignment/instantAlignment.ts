import type { AlignmentInput, AlignmentOutput, GeographicPoint } from '../../types/astronomy';
import { getBodyHorizontalPosition } from '../astronomy/position';
import { angularSeparation, angularDifference } from '../geometry/angularSeparation';
import { greatCircleDistanceKm } from '../geometry/distance';
import { initialBearing } from '../geometry/bearing';
import { targetAltitude } from '../geometry/altitude';

export interface InstantAlignmentInput {
  observer: GeographicPoint;
  target: GeographicPoint;
  object: AlignmentInput['object'];
  datetime: Date;
  toleranceDegrees: number;
}

export function calculateAlignmentAtInstant(input: InstantAlignmentInput): AlignmentOutput {
  const { observer, target, object, datetime, toleranceDegrees } = input;

  if (!Number.isFinite(toleranceDegrees) || toleranceDegrees < 0) {
    throw new Error('Tolerance must be a non-negative number');
  }

  const objectPosition = getBodyHorizontalPosition(object, datetime, observer);

  const distanceKm = greatCircleDistanceKm(
    observer.latitude,
    observer.longitude,
    target.latitude,
    target.longitude
  );

  const bearing = initialBearing(
    observer.latitude,
    observer.longitude,
    target.latitude,
    target.longitude
  );

  const targetAlt = targetAltitude(observer, target, distanceKm);

  const targetDirection = {
    distanceKm,
    bearing,
    altitude: targetAlt
  };

  const angularSeparationValue = angularSeparation(objectPosition, {
    azimuth: bearing,
    altitude: targetAlt
  });

  return {
    object: objectPosition,
    target: targetDirection,
    alignment: {
      angularSeparation: angularSeparationValue,
      azimuthDelta: angularDifference(objectPosition.azimuth, bearing),
      altitudeDelta: Math.abs(objectPosition.altitude - targetAlt),
      withinTolerance: angularSeparationValue <= toleranceDegrees
    }
  };
}
