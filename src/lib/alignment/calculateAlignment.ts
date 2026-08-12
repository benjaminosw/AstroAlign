import type { AlignmentInput, AlignmentOutput, GeographicPoint } from '../../types/astronomy';
export type { AlignmentInput } from '../../types/astronomy';
import { getBodyHorizontalPosition } from '../astronomy/position';
import { angularSeparation, angularDifference } from '../geometry/angularSeparation';
import { greatCircleDistanceKm } from '../geometry/distance';
import { initialBearing } from '../geometry/bearing';
import { targetAltitude } from '../geometry/altitude';

function assertValidLatitude(value: number, label: string) {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new Error(`${label} latitude must be between -90 and 90 degrees`);
  }
}

function assertValidLongitude(value: number, label: string) {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new Error(`${label} longitude must be between -180 and 180 degrees`);
  }
}

function assertValidElevation(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} elevation must be a valid number`);
  }
}

function assertValidDate(date: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
    throw new Error('Date must be a valid ISO date');
  }
}

function assertValidTime(time: string) {
  if (!/^[0-9]{2}:[0-9]{2}$/.test(time)) {
    throw new Error('Time must be in HH:MM format');
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Time must be a valid 24-hour time');
  }
}

function assertValidTolerance(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Tolerance must be a non-negative number');
  }
}

import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';

function buildDateTime(date: string, time: string, timeZone?: string): Date {
  if (!timeZone) {
    throw new Error('Observer timezone is required to interpret local date and time');
  }

  return convertLocalTimeToUtc(date, time, timeZone);
}

function assertValidPoint(point: GeographicPoint, label: string) {
  assertValidLatitude(point.latitude, label);
  assertValidLongitude(point.longitude, label);
  assertValidElevation(point.elevation, label);
}

export type AlignmentResult = AlignmentOutput;

export function calculateAlignment(input: AlignmentInput): AlignmentOutput {
  assertValidPoint(input.observer, 'Observer');
  assertValidPoint(input.target, 'Target');
  assertValidDate(input.date);
  assertValidTime(input.time);
  assertValidTolerance(input.toleranceDegrees);

  const datetime = buildDateTime(input.date, input.time, input.timeZone);
  const objectPosition = getBodyHorizontalPosition(input.object, datetime, input.observer);

  const distanceKm = greatCircleDistanceKm(
    input.observer.latitude,
    input.observer.longitude,
    input.target.latitude,
    input.target.longitude
  );

  const bearing = initialBearing(
    input.observer.latitude,
    input.observer.longitude,
    input.target.latitude,
    input.target.longitude
  );

  const targetAlt = targetAltitude(input.observer, input.target, distanceKm);

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
      withinTolerance: angularSeparationValue <= input.toleranceDegrees
    }
  };
}
